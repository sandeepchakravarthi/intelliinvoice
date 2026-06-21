import json
from functools import lru_cache
from pathlib import Path


CONFIG_PATH = Path(__file__).parent.parent.parent / "config.json"


@lru_cache(maxsize=1)
def get_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def get_database_url() -> str:
    cfg = get_config()["database"]
    return (
        f"postgresql+asyncpg://{cfg['user']}:{cfg['password']}"
        f"@{cfg['host']}:{cfg['port']}/{cfg['name']}"
    )


def get_redis_url() -> str:
    cfg = get_config()["redis"]
    return f"redis://{cfg['host']}:{cfg['port']}/{cfg['db']}"
