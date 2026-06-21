import io
from datetime import timedelta
from typing import Optional

from minio import Minio
from minio.error import S3Error

from app.core.config import get_config
from app.core.logging import get_logger


logger = get_logger(__name__)


class StorageService:
    """
    Wraps MinIO object storage operations.
    Handles invoice file upload, presigned URL generation, download, and deletion.
    Automatically creates required buckets if they do not exist.
    """

    def __init__(self) -> None:
        cfg = get_config()["minio"]
        self._client = Minio(
            endpoint=cfg["endpoint"],
            access_key=cfg["access_key"],
            secret_key=cfg["secret_key"],
            secure=cfg["secure"],
        )
        self._bucket = cfg["bucket_invoices"]
        self._expiry_seconds = cfg["presigned_url_expiry_seconds"]
        self._ensure_bucket(self._bucket)
        self._ensure_bucket(cfg["bucket_contracts"])

    def _ensure_bucket(self, name: str) -> None:
        try:
            if not self._client.bucket_exists(name):
                self._client.make_bucket(name)
                logger.info(f"Created MinIO bucket: {name}")
        except S3Error as exc:
            logger.error(f"Failed to ensure bucket '{name}': {exc}")
            raise RuntimeError(f"Storage initialisation failed: {exc}")

    def upload(self, file_bytes: bytes, object_name: str, content_type: str) -> str:
        try:
            self._client.put_object(
                bucket_name=self._bucket,
                object_name=object_name,
                data=io.BytesIO(file_bytes),
                length=len(file_bytes),
                content_type=content_type,
            )
            logger.info(f"Uploaded to MinIO: {object_name} ({len(file_bytes)} bytes)")
            return object_name
        except S3Error as exc:
            logger.error(f"MinIO upload failed for {object_name}: {exc}")
            raise RuntimeError(f"File upload failed: {exc}")

    def get_presigned_url(self, object_name: str) -> str:
        try:
            return self._client.presigned_get_object(
                bucket_name=self._bucket,
                object_name=object_name,
                expires=timedelta(seconds=self._expiry_seconds),
            )
        except S3Error as exc:
            logger.error(f"Presigned URL generation failed for {object_name}: {exc}")
            raise RuntimeError(f"Could not generate download URL: {exc}")

    def delete(self, object_name: str) -> None:
        try:
            self._client.remove_object(self._bucket, object_name)
            logger.info(f"Deleted from MinIO: {object_name}")
        except S3Error as exc:
            logger.warning(f"MinIO delete failed for {object_name}: {exc}")


_instance: Optional[StorageService] = None


def get_storage() -> StorageService:
    global _instance
    if _instance is None:
        _instance = StorageService()
    return _instance
