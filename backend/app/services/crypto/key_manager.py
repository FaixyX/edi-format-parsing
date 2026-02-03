"""
Key Manager for envelope encryption.

Manages Data Encryption Keys (DEKs) and index keys:
- Generates new keys (os.urandom)
- Wraps/unwraps keys using Fly KMS
- Caches unwrapped keys in memory (with TTL)
- Stores wrapped keys in the database

For a single-tenant app, use tenant_id='GLOBAL'.
For multi-tenant, use the actual tenant UUID.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from uuid import UUID

from .fly_kms_client import FlyKMSClient

logger = logging.getLogger(__name__)


# Key sizes
DEK_SIZE = 32  # AES-256
INDEX_KEY_SIZE = 32  # HMAC-SHA256

# Default cache TTL
DEFAULT_CACHE_TTL_MINUTES = 30


class KeyManager:
    """
    Manages Data Encryption Keys (DEKs) and index keys for envelope encryption.
    
    Keys are:
    - Generated locally (os.urandom)
    - Wrapped (encrypted) with Fly KMS before storage
    - Cached in memory after unwrapping (with TTL)
    
    This class does NOT handle actual data encryption - that's CryptoService's job.
    """
    
    def __init__(
        self,
        kms_client: FlyKMSClient,
        tenant_keys_repo,  # TenantKeysRepository
        cache_ttl_minutes: int = DEFAULT_CACHE_TTL_MINUTES,
    ):
        """
        Initialize KeyManager.
        
        Args:
            kms_client: FlyKMSClient instance for key wrapping
            tenant_keys_repo: Repository for storing/loading wrapped keys
            cache_ttl_minutes: How long to cache unwrapped keys in memory
        """
        self.kms = kms_client
        self.repo = tenant_keys_repo
        self._cache_ttl = timedelta(minutes=cache_ttl_minutes)
        
        # In-memory cache: tenant_id -> (key_bytes, timestamp)
        self._dek_cache: Dict[str, Tuple[bytes, datetime]] = {}
        self._index_key_cache: Dict[Tuple[str, str], Tuple[bytes, datetime]] = {}
    
    def _is_cache_valid(self, cached_at: datetime) -> bool:
        """Check if a cached entry is still valid."""
        return datetime.utcnow() - cached_at < self._cache_ttl
    
    def _normalize_tenant_id(self, tenant_id: Optional[str | UUID]) -> str:
        """Normalize tenant_id to string."""
        if tenant_id is None:
            return "GLOBAL"
        return str(tenant_id)
    
    # -------------------------------------------------------------------------
    # Key creation
    # -------------------------------------------------------------------------
    
    def create_tenant_keys(self, tenant_id: Optional[str | UUID] = None) -> None:
        """
        Generate and store new DEK + index key for a tenant.
        
        Keys are wrapped with KMS before storage.
        
        Args:
            tenant_id: Tenant identifier (None or 'GLOBAL' for single-tenant)
            
        Raises:
            ValueError: If keys already exist for this tenant
        """
        tid = self._normalize_tenant_id(tenant_id)
        
        # Check if keys already exist
        existing = self.repo.get_tenant_keys(tid)
        if existing:
            raise ValueError(f"Keys already exist for tenant {tid}")
        
        # Generate random keys
        dek = os.urandom(DEK_SIZE)
        index_key = os.urandom(INDEX_KEY_SIZE)
        
        logger.info(f"Generated new keys for tenant {tid}")
        
        # Wrap keys with KMS
        dek_ciphertext = self.kms.encrypt_key(dek)
        index_key_ciphertext = self.kms.encrypt_key(index_key)
        
        logger.debug(f"Wrapped keys with KMS label '{self.kms.label}'")
        
        # Store in database
        self.repo.insert_tenant_keys(
            tenant_id=tid,
            dek_ciphertext=dek_ciphertext,
            index_key_ciphertext=index_key_ciphertext,
            kms_label=self.kms.label,
            kms_version=0,  # Will be updated on rotation
        )
        
        # Cache the unwrapped keys
        now = datetime.utcnow()
        self._dek_cache[tid] = (dek, now)
        self._index_key_cache[(tid, "default")] = (index_key, now)
        
        logger.info(f"Stored wrapped keys for tenant {tid}")
    
    def ensure_tenant_keys(self, tenant_id: Optional[str | UUID] = None) -> None:
        """
        Ensure keys exist for tenant, creating them if not.
        
        Args:
            tenant_id: Tenant identifier
        """
        tid = self._normalize_tenant_id(tenant_id)
        
        existing = self.repo.get_tenant_keys(tid)
        if not existing:
            logger.info(f"No keys found for tenant {tid}, creating...")
            self.create_tenant_keys(tenant_id)
    
    # -------------------------------------------------------------------------
    # Key retrieval (with caching)
    # -------------------------------------------------------------------------
    
    def get_dek(self, tenant_id: Optional[str | UUID] = None) -> bytes:
        """
        Get the Data Encryption Key for a tenant.
        
        Returns cached key if available and valid, otherwise unwraps from DB.
        
        Args:
            tenant_id: Tenant identifier
            
        Returns:
            32-byte DEK
            
        Raises:
            ValueError: If no keys exist for tenant
        """
        tid = self._normalize_tenant_id(tenant_id)
        
        # Check cache first
        cached = self._dek_cache.get(tid)
        if cached and self._is_cache_valid(cached[1]):
            logger.debug(f"DEK cache hit for tenant {tid}")
            return cached[0]
        
        # Load from database
        record = self.repo.get_tenant_keys(tid)
        if not record:
            raise ValueError(f"No keys found for tenant {tid}. Call create_tenant_keys() first.")
        
        # Unwrap with KMS
        dek = self.kms.decrypt_key(record.dek_ciphertext)
        
        # Update cache
        self._dek_cache[tid] = (dek, datetime.utcnow())
        logger.debug(f"DEK loaded and cached for tenant {tid}")
        
        return dek
    
    def get_index_key(
        self,
        tenant_id: Optional[str | UUID] = None,
        purpose: str = "default",
    ) -> bytes:
        """
        Get an index key for HMAC blind indexes.
        
        Args:
            tenant_id: Tenant identifier
            purpose: Key purpose/scope (e.g., 'patient_name', 'claim_number')
            
        Returns:
            32-byte index key
            
        Raises:
            ValueError: If no keys exist for tenant
        """
        tid = self._normalize_tenant_id(tenant_id)
        cache_key = (tid, purpose)
        
        # Check cache
        cached = self._index_key_cache.get(cache_key)
        if cached and self._is_cache_valid(cached[1]):
            logger.debug(f"Index key cache hit for tenant {tid}, purpose {purpose}")
            return cached[0]
        
        # Load from database
        record = self.repo.get_tenant_keys(tid)
        if not record:
            raise ValueError(f"No keys found for tenant {tid}. Call create_tenant_keys() first.")
        
        # Unwrap with KMS
        index_key = self.kms.decrypt_key(record.index_key_ciphertext)
        
        # For different purposes, derive a sub-key using HKDF
        # This allows using the same stored key for multiple index types
        if purpose != "default":
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.kdf.hkdf import HKDF
            
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=INDEX_KEY_SIZE,
                salt=None,
                info=purpose.encode("utf-8"),
            )
            index_key = hkdf.derive(index_key)
        
        # Update cache
        self._index_key_cache[cache_key] = (index_key, datetime.utcnow())
        logger.debug(f"Index key loaded and cached for tenant {tid}, purpose {purpose}")
        
        return index_key
    
    # -------------------------------------------------------------------------
    # Cache management
    # -------------------------------------------------------------------------
    
    def clear_cache(self, tenant_id: Optional[str | UUID] = None) -> None:
        """
        Clear cached keys.
        
        Args:
            tenant_id: If provided, clear only this tenant's cache.
                      If None, clear all caches.
        """
        if tenant_id is not None:
            tid = self._normalize_tenant_id(tenant_id)
            self._dek_cache.pop(tid, None)
            # Clear all index keys for this tenant
            self._index_key_cache = {
                k: v for k, v in self._index_key_cache.items()
                if k[0] != tid
            }
            logger.debug(f"Cleared cache for tenant {tid}")
        else:
            self._dek_cache.clear()
            self._index_key_cache.clear()
            logger.debug("Cleared all key caches")
    
    # -------------------------------------------------------------------------
    # Key rotation helpers
    # -------------------------------------------------------------------------
    
    def rotate_dek(self, tenant_id: Optional[str | UUID] = None) -> None:
        """
        Rotate the DEK for a tenant.
        
        This generates a new DEK, wraps it with KMS, and updates the DB.
        
        WARNING: After rotation, existing encrypted data must be re-encrypted
        with the new DEK. This method only updates the key, not the data.
        
        Args:
            tenant_id: Tenant identifier
        """
        tid = self._normalize_tenant_id(tenant_id)
        
        # Ensure keys exist
        record = self.repo.get_tenant_keys(tid)
        if not record:
            raise ValueError(f"No keys found for tenant {tid}")
        
        # Generate new DEK
        new_dek = os.urandom(DEK_SIZE)
        new_dek_ciphertext = self.kms.encrypt_key(new_dek)
        
        # Update in database
        self.repo.update_dek(
            tenant_id=tid,
            dek_ciphertext=new_dek_ciphertext,
            kms_label=self.kms.label,
        )
        
        # Clear cache to force reload
        self.clear_cache(tenant_id)
        
        logger.warning(
            f"DEK rotated for tenant {tid}. "
            "Remember to re-encrypt existing data!"
        )

