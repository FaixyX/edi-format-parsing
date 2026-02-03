import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.system_configuration import SystemConfiguration
from app.schemas.system_configuration import (
    SystemConfigurationCreate,
    SystemConfigurationUpdate,
    SyncIntervalConfigUpdate,
)
from datetime import datetime

logger = logging.getLogger(__name__)


class SystemConfigurationService:
    """Service for managing system configuration settings"""

    @staticmethod
    def get_configuration(db: Session, key: str) -> Optional[SystemConfiguration]:
        """Get a configuration by key"""
        return (
            db.query(SystemConfiguration)
            .filter(
                SystemConfiguration.key == key, SystemConfiguration.is_active == True
            )
            .first()
        )

    @staticmethod
    def get_all_configurations(db: Session) -> list[SystemConfiguration]:
        """Get all active configurations"""
        return (
            db.query(SystemConfiguration)
            .filter(SystemConfiguration.is_active == True)
            .all()
        )

    @staticmethod
    def create_configuration(
        db: Session, config: SystemConfigurationCreate
    ) -> SystemConfiguration:
        """Create a new configuration"""
        try:
            db_config = SystemConfiguration(**config.dict())
            db.add(db_config)
            db.commit()
            db.refresh(db_config)
            # Do not log configuration values (may contain secrets)
            logger.info(f"Created configuration: {config.key}")
            return db_config
        except IntegrityError:
            db.rollback()
            raise ValueError(f"Configuration with key '{config.key}' already exists")

    @staticmethod
    def update_configuration(
        db: Session, key: str, config_update: SystemConfigurationUpdate
    ) -> Optional[SystemConfiguration]:
        """Update an existing configuration"""
        db_config = (
            db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
        )

        if not db_config:
            return None

        # Validate value against data type if value is being updated
        if config_update.value is not None:
            try:
                if db_config.data_type == "integer":
                    int(config_update.value)
                elif db_config.data_type == "float":
                    float(config_update.value)
                elif db_config.data_type == "boolean":
                    if config_update.value.lower() not in ["true", "false"]:
                        raise ValueError("Boolean value must be 'true' or 'false'")
            except ValueError as e:
                raise ValueError(
                    f"Value '{config_update.value}' is not valid for data_type '{db_config.data_type}': {str(e)}"
                )

        # Update fields
        update_data = config_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_config, field, value)

        db_config.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_config)
        # Do not log configuration values (may contain secrets)
        logger.info(f"Updated configuration: {key}")
        return db_config

    @staticmethod
    def delete_configuration(db: Session, key: str) -> bool:
        """Delete a configuration (soft delete by setting is_active=False)"""
        db_config = (
            db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
        )

        if not db_config:
            return False

        db_config.is_active = False
        db_config.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"Deleted configuration: {key}")
        return True

    @staticmethod
    def get_config_value(db: Session, key: str, default: Any = None) -> Any:
        """Get a configuration value with type conversion and default fallback"""
        config = SystemConfigurationService.get_configuration(db, key)

        if not config:
            logger.warning(f"Configuration '{key}' not found, using default: {default}")
            return default

        try:
            if config.data_type == "integer":
                return int(config.value)
            elif config.data_type == "float":
                return float(config.value)
            elif config.data_type == "boolean":
                return config.value.lower() == "true"
            else:  # string
                return config.value
        except ValueError as e:
            logger.error(
                f"Error converting configuration '{key}' value '{config.value}' to type '{config.data_type}': {str(e)}"
            )
            return default

    @staticmethod
    def set_config_value(
        db: Session,
        key: str,
        value: Any,
        description: str = None,
        data_type: str = "string",
    ) -> SystemConfiguration:
        """Set a configuration value, creating if it doesn't exist"""
        # Convert value to string for storage
        if isinstance(value, bool):
            value_str = "true" if value else "false"
            data_type = "boolean"
        elif isinstance(value, (int, float)):
            value_str = str(value)
            data_type = "integer" if isinstance(value, int) else "float"
        else:
            value_str = str(value)

        # Check if configuration exists
        existing_config = SystemConfigurationService.get_configuration(db, key)

        if existing_config:
            # Update existing
            update_data = SystemConfigurationUpdate(value=value_str)
            if description:
                update_data.description = description
            return SystemConfigurationService.update_configuration(db, key, update_data)
        else:
            # Create new
            create_data = SystemConfigurationCreate(
                key=key, value=value_str, description=description, data_type=data_type
            )
            return SystemConfigurationService.create_configuration(db, create_data)

    @staticmethod
    def get_sync_interval_minutes(db: Session) -> int:
        """Get the sync interval in minutes, with default of 30"""
        return SystemConfigurationService.get_config_value(
            db, "sync_interval_minutes", 30
        )

    @staticmethod
    def set_sync_interval_minutes(db: Session, minutes: int) -> SystemConfiguration:
        """Set the sync interval in minutes with validation"""
        if not (1 <= minutes <= 1440):  # 1 minute to 24 hours
            raise ValueError("Sync interval must be between 1 and 1440 minutes")

        return SystemConfigurationService.set_config_value(
            db,
            "sync_interval_minutes",
            minutes,
            "Sync interval in minutes",
            "integer",
        )

    @staticmethod
    def initialize_default_configurations(db: Session) -> None:
        """Initialize default system configurations if they don't exist"""
        default_configs = [
            {
                "key": "sync_interval_minutes",
                "value": "30",
                "description": "Sync interval in minutes",
                "data_type": "integer",
            },
            {
                "key": "sync_enabled",
                "value": "true",
                "description": "Whether automatic sync is enabled",
                "data_type": "boolean",
            },
            {
                "key": "max_sync_retries",
                "value": "3",
                "description": "Maximum number of retry attempts for failed syncs",
                "data_type": "integer",
            },
            {
                "key": "edi_billing_max_retries",
                "value": "3",
                "description": "Maximum number of retry attempts for EDI billing file processing",
                "data_type": "integer",
            },
            {
                "key": "edi_billing_delay_seconds",
                "value": "0",
                "description": "Delay in seconds before processing EDI billing file tasks",
                "data_type": "integer",
            },
        ]

        for config_data in default_configs:
            existing = SystemConfigurationService.get_configuration(
                db, config_data["key"]
            )
            if not existing:
                try:
                    SystemConfigurationService.create_configuration(
                        db, SystemConfigurationCreate(**config_data)
                    )
                    logger.info(
                        f"Initialized default configuration: {config_data['key']}"
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to initialize configuration {config_data['key']}: {str(e)}"
                    )

    @staticmethod
    def get_sync_configuration(db: Session) -> Dict[str, Any]:
        """Get all sync-related configuration as a dictionary"""
        return {
            "sync_interval_minutes": SystemConfigurationService.get_sync_interval_minutes(
                db
            ),
            "sync_enabled": SystemConfigurationService.get_sync_enabled(db),
            "max_sync_retries": SystemConfigurationService.get_max_sync_retries(db),
        }

    @staticmethod
    def get_sync_enabled(db: Session) -> bool:
        """Get sync enabled status with default of True"""
        return SystemConfigurationService.get_config_value(db, "sync_enabled", True)

    @staticmethod
    def set_sync_enabled(db: Session, enabled: bool) -> SystemConfiguration:
        """Set sync enabled status"""
        return SystemConfigurationService.set_config_value(
            db,
            "sync_enabled",
            enabled,
            "Whether automatic sync is enabled",
            "boolean",
        )

    @staticmethod
    def get_max_sync_retries(db: Session) -> int:
        """Get max sync retries with default of 3"""
        return SystemConfigurationService.get_config_value(db, "max_sync_retries", 3)

    @staticmethod
    def set_max_sync_retries(db: Session, max_retries: int) -> SystemConfiguration:
        """Set max sync retries with validation"""
        if not (1 <= max_retries <= 10):
            raise ValueError("Max retries must be between 1 and 10")

        return SystemConfigurationService.set_config_value(
            db,
            "max_sync_retries",
            max_retries,
            "Maximum number of retry attempts for failed syncs",
            "integer",
        )

    @staticmethod
    def bulk_update_sync_configuration(
        db: Session,
        sync_interval_minutes: Optional[int] = None,
        sync_enabled: Optional[bool] = None,
        max_retries: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Bulk update sync configuration settings.
        Returns a dictionary with updated values and metadata.
        """
        updated_fields = []

        # Update sync interval if provided
        if sync_interval_minutes is not None:
            SystemConfigurationService.set_sync_interval_minutes(
                db, sync_interval_minutes
            )
            updated_fields.append("sync_interval_minutes")

        # Update sync enabled if provided
        if sync_enabled is not None:
            SystemConfigurationService.set_sync_enabled(db, sync_enabled)
            updated_fields.append("sync_enabled")

        # Update max retries if provided
        if max_retries is not None:
            SystemConfigurationService.set_max_sync_retries(db, max_retries)
            updated_fields.append("max_retries")

        # Get current configuration values
        current_config = SystemConfigurationService.get_sync_configuration(db)

        return {
            "sync_interval_minutes": current_config["sync_interval_minutes"],
            "sync_enabled": current_config["sync_enabled"],
            "max_retries": current_config["max_sync_retries"],
            "updated_fields": updated_fields,
            "status": "success" if updated_fields else "no_changes",
        }

    @staticmethod
    def get_edi_billing_max_retries(db: Session) -> int:
        """Get EDI billing max retries with default of 3"""
        return SystemConfigurationService.get_config_value(
            db, "edi_billing_max_retries", 3
        )

    @staticmethod
    def set_edi_billing_max_retries(
        db: Session, max_retries: int
    ) -> SystemConfiguration:
        """Set EDI billing max retries with validation"""
        if not (1 <= max_retries <= 10):
            raise ValueError("EDI billing max retries must be between 1 and 10")

        return SystemConfigurationService.set_config_value(
            db,
            "edi_billing_max_retries",
            max_retries,
            "Maximum number of retry attempts for EDI billing file processing",
            "integer",
        )

    @staticmethod
    def get_edi_billing_delay_seconds(db: Session) -> int:
        """Get EDI billing delay in seconds with default of 0"""
        return SystemConfigurationService.get_config_value(
            db, "edi_billing_delay_seconds", 0
        )

    @staticmethod
    def set_edi_billing_delay_seconds(
        db: Session, delay_seconds: int
    ) -> SystemConfiguration:
        """Set EDI billing delay in seconds with validation"""
        if not (0 <= delay_seconds <= 3600):  # 0 to 1 hour
            raise ValueError("EDI billing delay must be between 0 and 3600 seconds")

        return SystemConfigurationService.set_config_value(
            db,
            "edi_billing_delay_seconds",
            delay_seconds,
            "Delay in seconds before processing EDI billing file tasks",
            "integer",
        )

    @staticmethod
    def get_edi_billing_configuration(db: Session) -> Dict[str, Any]:
        """Get all EDI billing-related configuration as a dictionary"""
        return {
            "edi_billing_max_retries": SystemConfigurationService.get_edi_billing_max_retries(
                db
            ),
            "edi_billing_delay_seconds": SystemConfigurationService.get_edi_billing_delay_seconds(
                db
            ),
        }

    @staticmethod
    def bulk_update_edi_billing_configuration(
        db: Session,
        max_retries: Optional[int] = None,
        delay_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Bulk update EDI billing configuration settings.
        Returns a dictionary with updated values and metadata.
        """
        updated_fields = []

        # Update max retries if provided
        if max_retries is not None:
            SystemConfigurationService.set_edi_billing_max_retries(db, max_retries)
            updated_fields.append("edi_billing_max_retries")

        # Update delay if provided
        if delay_seconds is not None:
            SystemConfigurationService.set_edi_billing_delay_seconds(db, delay_seconds)
            updated_fields.append("edi_billing_delay_seconds")

        # Get current configuration values
        current_config = SystemConfigurationService.get_edi_billing_configuration(db)

        return {
            "edi_billing_max_retries": current_config["edi_billing_max_retries"],
            "edi_billing_delay_seconds": current_config["edi_billing_delay_seconds"],
            "updated_fields": updated_fields,
            "status": "success" if updated_fields else "no_changes",
        }