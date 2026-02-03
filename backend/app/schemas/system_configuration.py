from pydantic import BaseModel, Field, validator
from typing import Optional, Union
from uuid import UUID
from datetime import datetime


class SystemConfigurationBase(BaseModel):
    key: str = Field(..., description="Configuration key")
    value: str = Field(..., description="Configuration value as string")
    description: Optional[str] = Field(
        None, description="Description of the configuration"
    )
    data_type: str = Field(
        "string", description="Data type: string, integer, boolean, float"
    )
    is_active: bool = Field(True, description="Whether the configuration is active")

    @validator("data_type")
    def validate_data_type(cls, v):
        allowed_types = ["string", "integer", "boolean", "float"]
        if v not in allowed_types:
            raise ValueError(f"data_type must be one of: {allowed_types}")
        return v

    @validator("value")
    def validate_value_matches_type(cls, v, values):
        if "data_type" not in values:
            return v

        data_type = values["data_type"]
        try:
            if data_type == "integer":
                int(v)
            elif data_type == "float":
                float(v)
            elif data_type == "boolean":
                if v.lower() not in ["true", "false"]:
                    raise ValueError("Boolean value must be 'true' or 'false'")
        except ValueError:
            raise ValueError(f"Value '{v}' is not valid for data_type '{data_type}'")
        return v


class SystemConfigurationCreate(SystemConfigurationBase):
    pass


class SystemConfigurationUpdate(BaseModel):
    value: Optional[str] = Field(None, description="Configuration value as string")
    description: Optional[str] = Field(
        None, description="Description of the configuration"
    )
    is_active: Optional[bool] = Field(
        None, description="Whether the configuration is active"
    )

    @validator("value")
    def validate_value_if_provided(cls, v):
        # Note: We can't validate against data_type here since we don't have the full object
        # This validation should be done in the service layer
        return v


class SystemConfigurationOut(SystemConfigurationBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SyncIntervalConfigOut(BaseModel):
    """Specialized schema for sync interval configuration"""

    sync_interval_minutes: int = Field(..., description="Sync interval in minutes")
    description: Optional[str] = Field(
        None, description="Description of the sync interval setting"
    )
    last_updated: datetime = Field(
        ..., description="When this configuration was last updated"
    )

    class Config:
        from_attributes = True


class SyncIntervalConfigUpdate(BaseModel):
    """Schema for updating sync interval"""

    sync_interval_minutes: int = Field(
        ..., ge=1, le=1440, description="Sync interval in minutes (1-1440)"
    )


class SyncEnabledUpdate(BaseModel):
    """Schema for updating sync enabled status"""

    enabled: bool = Field(..., description="Whether sync is enabled")


class MaxRetriesUpdate(BaseModel):
    """Schema for updating max retries"""

    max_retries: int = Field(
        ..., ge=1, le=10, description="Maximum retry attempts (1-10)"
    )


class SyncConfigurationBulkUpdate(BaseModel):
    """Schema for bulk updating all sync configuration settings"""

    sync_interval_minutes: Optional[int] = Field(
        None, ge=1, le=1440, description="Sync interval in minutes (1-1440)"
    )
    sync_enabled: Optional[bool] = Field(None, description="Whether sync is enabled")
    max_retries: Optional[int] = Field(
        None, ge=1, le=10, description="Maximum retry attempts (1-10)"
    )

    @validator("sync_interval_minutes")
    def validate_sync_interval(cls, v):
        if v is not None and not (1 <= v <= 1440):
            raise ValueError("Sync interval must be between 1 and 1440 minutes")
        return v

    @validator("max_retries")
    def validate_max_retries(cls, v):
        if v is not None and not (1 <= v <= 10):
            raise ValueError("Max retries must be between 1 and 10")
        return v


class SyncConfigurationBulkUpdateResponse(BaseModel):
    """Response schema for bulk sync configuration update"""

    sync_interval_minutes: int = Field(
        ..., description="Updated sync interval in minutes"
    )
    sync_enabled: bool = Field(..., description="Updated sync enabled status")
    max_retries: int = Field(..., description="Updated max retry attempts")
    updated_fields: list[str] = Field(
        ..., description="List of fields that were updated"
    )
    status: str = Field(..., description="Overall status of the update")


class EdiBillingConfigurationBulkUpdate(BaseModel):
    """Schema for bulk updating EDI billing configuration settings"""

    max_retries: Optional[int] = Field(
        None, ge=1, le=10, description="Maximum retry attempts (1-10)"
    )
    delay_seconds: Optional[int] = Field(
        None, ge=0, le=3600, description="Delay in seconds before processing (0-3600)"
    )

    @validator("max_retries")
    def validate_max_retries(cls, v):
        if v is not None and not (1 <= v <= 10):
            raise ValueError("Max retries must be between 1 and 10")
        return v

    @validator("delay_seconds")
    def validate_delay_seconds(cls, v):
        if v is not None and not (0 <= v <= 3600):
            raise ValueError("Delay seconds must be between 0 and 3600")
        return v


class EdiBillingConfigurationBulkUpdateResponse(BaseModel):
    """Response schema for bulk EDI billing configuration update"""

    edi_billing_max_retries: int = Field(
        ..., description="Updated EDI billing max retry attempts"
    )
    edi_billing_delay_seconds: int = Field(
        ..., description="Updated EDI billing delay in seconds"
    )
    updated_fields: list[str] = Field(
        ..., description="List of fields that were updated"
    )
    status: str = Field(..., description="Overall status of the update")


