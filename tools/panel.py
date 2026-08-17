"""通用面板写入器：把 LLM 生成的文本写进 DSH 右侧悬浮面板 JSON。

用法：
  python tools/panel.py --panel polish --file out.json      # 把 out.json 的内容写入润色面板
  python tools/panel.py --panel prereview --file out.json
  python tools/panel.py --panel proposal --file out.json
  python tools/panel.py --panel polish --clear              # 清空面板

--file 指向一个 JSON 文件（顶层为 dict；若不是 dict 会包成 {"content": ...}）。
写入时自动加上 updated 时间戳，供面板轮询刷新。
"""
import argparse
import json
import os
import sys
import time

from _common import load_config

PANEL_KEYS = {
    "polish": "polish_json_path",
    "prereview": "prereview_json_path",
    "proposal": "proposal_json_path",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--panel", required=True, choices=list(PANEL_KEYS), help="目标面板")
    ap.add_argument("--file", default="", help="要写入的 JSON 文件路径")
    ap.add_argument("--clear", action="store_true", help="清空该面板")
    a = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    cfg = load_config()
    node = cfg.get("panel", {}) if isinstance(cfg.get("panel", {}), dict) else {}
    path = node.get(PANEL_KEYS[a.panel], "")
    if not path:
        print(f"[error] 未配置 panel.{PANEL_KEYS[a.panel]}，请在 config.json 填写")
        sys.exit(1)

    os.makedirs(os.path.dirname(path), exist_ok=True)

    if a.clear:
        json.dump({"updated": time.time()}, open(path, "w", encoding="utf-8"), ensure_ascii=False)
        print(f"[panel] 已清空 {a.panel} → {path}")
        return

    if not a.file or not os.path.exists(a.file):
        print("[error] 需要 --file 指向一个 JSON 文件")
        sys.exit(1)

    data = json.load(open(a.file, encoding="utf-8"))
    if not isinstance(data, dict):
        data = {"content": data}
    data["updated"] = time.time()
    json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"[panel] 已写入 {a.panel} → {path}")


if __name__ == "__main__":
    main()
