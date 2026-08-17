"""共享工具：定位插件根目录 + 读取配置。"""
import json
import os
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parent.parent


def load_config() -> dict:
    p = PLUGIN_ROOT / "config.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return {}
    return {}


def api_key(cfg_path: str, env: str) -> str:
    cfg = load_config()
    node = cfg
    for part in cfg_path.split("."):
        node = node.get(part, {}) if isinstance(node, dict) else {}
    return (node or "") or os.getenv(env, "")
