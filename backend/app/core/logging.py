import logging
import logging.handlers
import sys
from pathlib import Path

from app.core.config import get_config


def setup_logging() -> None:
    cfg = get_config()["logging"]
    level = getattr(logging, cfg["level"].upper(), logging.INFO)

    log_file = Path(cfg["log_file"])
    log_file.parent.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()

    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console.setFormatter(formatter)
    root.addHandler(console)

    file_handler = logging.handlers.RotatingFileHandler(
        filename=log_file,
        maxBytes=cfg["max_bytes"],
        backupCount=cfg["backup_count"],
        encoding="utf-8",
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
