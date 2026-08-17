#!/usr/bin/env python3
"""图像生成：文生图 / 图生图（阿里云通义万相 / OpenAI 兼容 / 硅基流动）。

用法：
  python tools/image_gen.py "描述" [--size 1024x1024] [--out 输出.png]
  python tools/image_gen.py "描述" --mode img2img --ref 参考图.png [--out 输出.png]
"""
import argparse
import base64
import json
import os
import sys
import time

import requests

sys.stdout.reconfigure(encoding="utf-8")

PRESETS = {
    "qwen": {"base_url": "https://dashscope.aliyuncs.com", "model": "wanx2.1-t2i-turbo"},
    "openai": {"base_url": "https://api.openai.com/v1", "model": "gpt-image-1"},
    "siliconflow": {"base_url": "https://api.siliconflow.cn/v1", "model": "black-forest-labs/FLUX.1-schnell"},
}
T2I_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"


def _cfg():
    from _common import load_config, api_key

    c = load_config().get("image_gen", {})
    provider = c.get("provider", "qwen")
    preset = PRESETS.get(provider, {})
    return {
        "provider": provider,
        "api_key": c.get("api_key") or api_key("image_gen.api_key", "IMAGE_GEN_API_KEY"),
        "model": c.get("model") or preset.get("model", "wanx2.1-t2i-turbo"),
        "base_url": c.get("base_url") or preset.get("base_url", ""),
    }


def _dashscope(prompt, key, model, size, ref_bytes=None):
    body = {"model": model, "input": {"prompt": prompt},
            "parameters": {"size": size.replace("x", "*"), "n": 1}}
    if ref_bytes:
        body["input"]["ref_img"] = "data:image/png;base64," + base64.b64encode(ref_bytes).decode()
    h = {"Authorization": f"Bearer {key}", "Content-Type": "application/json", "X-DashScope-Async": "enable"}
    r = requests.post(T2I_URL, headers=h, json=body, timeout=60)
    r.raise_for_status()
    task_id = (r.json().get("output") or {}).get("task_id")
    if not task_id:
        return None, "未返回 task_id"
    for _ in range(40):
        time.sleep(3)
        pr = requests.get(f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}",
                          headers={"Authorization": f"Bearer {key}"}, timeout=30)
        pr.raise_for_status()
        o = pr.json().get("output") or {}
        if o.get("task_status") == "SUCCEEDED":
            rs = o.get("results") or []
            if rs and rs[0].get("url"):
                return requests.get(rs[0]["url"], timeout=90).content, ""
        elif o.get("task_status") in ("FAILED", "CANCELED", "UNKNOWN"):
            return None, f"任务{o['task_status']}"
    return None, "超时"


def _openai_compat(prompt, key, model, base_url, size):
    from openai import OpenAI
    import httpx

    client = OpenAI(base_url=base_url, api_key=key, http_client=httpx.Client(trust_env=True))
    resp = client.images.generate(model=model, prompt=prompt, size=size, n=1)
    item = resp.data[0]
    if getattr(item, "b64_json", None):
        return base64.b64decode(item.b64_json), ""
    if getattr(item, "url", None):
        return requests.get(item.url, timeout=90).content, ""
    return None, "无图片数据"


def _figure_cfg():
    from _common import load_config

    cfg = load_config()
    node = cfg.get("figure", {}) if isinstance(cfg, dict) else {}
    return {"output_dir": node.get("output_dir", ""), "json_path": node.get("json_path", "")}


def _write_panel(fig_path, prompt, model, provider, size):
    f = _figure_cfg()
    jp = f["json_path"] or os.getenv("FIGURE_PANEL_JSON", "")
    if not jp:
        return
    fig = {
        "prompt": prompt,
        "model": f"{provider}/{model}",
        "size": size,
        "url": "/assets/figures/" + os.path.basename(fig_path),
        "time": time.strftime("%H:%M:%S"),
    }
    try:
        data = {"updated": time.time(), "figures": []}
        if os.path.exists(jp):
            data = json.load(open(jp, encoding="utf-8"))
        data.setdefault("figures", []).insert(0, fig)
        data["updated"] = time.time()
        os.makedirs(os.path.dirname(jp), exist_ok=True)
        json.dump(data, open(jp, "w", encoding="utf-8"), ensure_ascii=False)
        print(f"[panel] 已更新 {jp}", file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        print(f"[panel] 更新失败: {e}", file=sys.stderr)


def _register(fig_path, prompt, method, model, size):
    """把已有图片（代码绘图/流程图/仿真图等）复制到 output_dir 并注册进面板。"""
    import shutil

    f = _figure_cfg()
    od, jp = f["output_dir"], f["json_path"]
    if not od or not jp:
        print("[error] 未配置 figure.output_dir/json_path")
        return
    os.makedirs(od, exist_ok=True)
    ext = os.path.splitext(fig_path)[1] or ".png"
    name = f"fig_{int(time.time())}{ext}"
    dest = os.path.join(od, name)
    shutil.copyfile(fig_path, dest)
    fig = {"prompt": prompt, "model": model or method, "size": size,
           "url": "/assets/figures/" + name, "time": time.strftime("%H:%M:%S")}
    data = {"updated": time.time(), "figures": []}
    if os.path.exists(jp):
        data = json.load(open(jp, encoding="utf-8"))
    data.setdefault("figures", []).insert(0, fig)
    data["updated"] = time.time()
    json.dump(data, open(jp, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"[panel] 已注册 {dest}")


def _remove(name):
    f = _figure_cfg()
    jp, od = f["json_path"], f["output_dir"]
    if not jp or not os.path.exists(jp):
        return
    data = json.load(open(jp, encoding="utf-8"))
    target = os.path.basename(name)
    kept, removed = [], []
    for fig in data.get("figures", []):
        if os.path.basename(fig.get("url", "")) == target:
            removed.append(fig)
        else:
            kept.append(fig)
    data["figures"] = kept
    data["updated"] = time.time()
    json.dump(data, open(jp, "w", encoding="utf-8"), ensure_ascii=False)
    for fig in removed:
        try:
            os.remove(os.path.join(od, os.path.basename(fig.get("url", ""))))
        except Exception:  # noqa: BLE001
            pass
    print(f"[panel] 已删除 {len(removed)} 张图")


def _clear():
    import shutil

    f = _figure_cfg()
    jp, od = f["json_path"], f["output_dir"]
    if jp:
        json.dump({"updated": time.time(), "figures": []}, open(jp, "w", encoding="utf-8"), ensure_ascii=False)
    if od and os.path.isdir(od):
        shutil.rmtree(od)
        os.makedirs(od, exist_ok=True)
    print("[panel] 已清空")


def _convert(data, fmt):
    """把 PNG 字节转成目标格式；失败则原样返回 PNG。"""
    if fmt in ("png", ""):
        return data, "png"
    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(data))
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        if fmt in ("jpg", "jpeg"):
            img.save(buf, "JPEG", quality=92)
            return buf.getvalue(), "jpg"
        if fmt == "webp":
            img.save(buf, "WEBP", quality=92)
            return buf.getvalue(), "webp"
    except Exception as e:  # noqa: BLE001
        print(f"[warn] 格式转换失败，保存为 PNG: {e}", file=sys.stderr)
    return data, "png"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt", nargs="?", default="")
    ap.add_argument("--mode", default="t2i", choices=["t2i", "img2img"])
    ap.add_argument("--ref")
    ap.add_argument("--size", default="1024x1024")
    ap.add_argument("--format", default="png", choices=["png", "jpg", "webp"], help="输出格式")
    ap.add_argument("--out", default="output/generated.png")
    ap.add_argument("--provider", default="", help="覆盖 provider（qwen/openai/siliconflow）")
    ap.add_argument("--model", default="", help="覆盖模型名")
    ap.add_argument("--key", default="", help="覆盖 API Key")
    ap.add_argument("--register", default="", help="注册已有图片路径到面板")
    ap.add_argument("--method", default="", help="出图方式（注册时标注）")
    ap.add_argument("--remove", default="", help="从面板删除图片（文件名或URL）")
    ap.add_argument("--clear", action="store_true", help="清空面板全部图片")
    a = ap.parse_args()

    if a.clear:
        _clear()
        return
    if a.remove:
        _remove(a.remove)
        return
    if a.register:
        _register(a.register, a.prompt, a.method or "register", "", "")
        return
    if not a.prompt:
        print("[error] 请提供提示词，或用 --register/--remove/--clear")
        sys.exit(1)

    c = _cfg()
    if a.provider:
        c["provider"] = a.provider
    if a.model:
        c["model"] = a.model
    if a.key:
        c["api_key"] = a.key
    if not c["api_key"]:
        print("[error] 未配置图像 API Key（config.json 的 image_gen.api_key 或 IMAGE_GEN_API_KEY）")
        sys.exit(1)

    ref_bytes = None
    if a.mode == "img2img":
        if not a.ref:
            print("[error] 图生图需要 --ref 参考图")
            sys.exit(1)
        ref_bytes = open(a.ref, "rb").read()

    try:
        if c["provider"] in ("qwen", "dashscope", "aliyun"):
            data, err = _dashscope(a.prompt, c["api_key"], c["model"], a.size, ref_bytes)
        else:
            if a.mode == "img2img":
                print("[error] 图生图当前仅支持阿里云通义万相")
                sys.exit(1)
            data, err = _openai_compat(a.prompt, c["api_key"], c["model"], c["base_url"], a.size)
    except Exception as e:  # noqa: BLE001
        print(f"[error] {e}")
        sys.exit(1)

    if err or not data:
        print(f"[error] {err}")
        sys.exit(1)

    out = a.out
    f = _figure_cfg()
    data, ext = _convert(data, a.format)
    if f["output_dir"]:
        os.makedirs(f["output_dir"], exist_ok=True)
        out = os.path.join(f["output_dir"], f"fig_{int(time.time())}.{ext}")
    else:
        base, old_ext = os.path.splitext(a.out)
        if not old_ext or old_ext.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            out = base + "." + ext
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    open(out, "wb").write(data)
    print(f"已生成：{out}")
    if f["output_dir"]:
        _write_panel(out, a.prompt, c["model"], c["provider"], a.size)


if __name__ == "__main__":
    main()
