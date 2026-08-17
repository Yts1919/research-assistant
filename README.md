# 🔬 Research Assistant 科研助手

> 面向本科生 / 研究生 / 博士生的**科研全流程 AI 助手插件**（Skill）。
> 分步辅助 + 人在环 —— 不搞「一键生成论文」，每一步产出都可审查、可返工。

<p align="center">
  <a href="#-功能"><img src="https://img.shields.io/badge/子技能-10-4f6ef7" alt="10 个子技能"></a>
  <a href="#-悬浮窗"><img src="https://img.shields.io/badge/悬浮窗-10-f97316" alt="10 个悬浮窗"></a>
  <a href="#-许可证"><img src="https://img.shields.io/badge/License-MIT-22c55e" alt="MIT"></a>
  <a href="#-导出"><img src="https://img.shields.io/badge/导出-Word%20·%20LaTeX%20·%20Markdown-8b5cf6" alt="导出格式"></a>
</p>

---

## ✨ 功能

科研写作的完整流程，一条龙覆盖：

| # | 子技能 | 能做什么 |
|---|---|---|
| 1 | 📚 literature-search | 跨 8 个源检索真实论文 + 分区/影响因子/免费PDF 标注 |
| 2 | 📖 paper-reading | 结构化精读论文，生成精读卡片 |
| 3 | 📝 literature-review | 生成带真实引用的文献综述 |
| 4 | ✍️ section-writing | 分节起草 + 多版本结果融合 |
| 5 | 🎨 figure-generation | 6 种方式出图（文生图/图生图/代码绘图/矢量图/流程图/仿真图）|
| 6 | 🔗 citation | 引文格式化（GB/T 7714 / APA / IEEE / MLA / 自定义）+ 文件夹批量扫描 |
| 7 | ✨ academic-polishing | 学术润色 / 改写 / 翻译 |
| 8 | 🔍 pre-review | 三位互盲审稿人模拟评审 |
| 9 | 🎯 proposal-writing | 开题报告 / 研究方案 |
| 10 | 📐 format-reformat | 按模板/要求改论文格式，可迭代预览 |

**关键能力**

- ✅ 全部来自真实公开数据源，不编造引用
- ✅ 期刊分区（中科院 / JCR / SJR）+ 影响因子自动标注
- ✅ 导出 **Word (.docx) / LaTeX (.tex) / Markdown (.md)** 三种格式，Word 与 LaTeX 两类用户都适用
- ✅ DeepSeek Harness 网页端有 **10 个悬浮窗** + 总开关

---

## 🚀 安装

### 环境要求

- **Python 3.9+**（推荐 3.11+）
- 安装依赖：

```bash
pip install -r requirements.txt
```

> 说明：插件**不依赖** `python-docx` / `lxml`（Word 读写用纯标准库 `zipfile` 实现，兼容性更好）。`graphviz` 出流程图需要额外装系统的 [Graphviz 二进制](https://graphviz.org/download/)。

### 方式一：DeepSeek Harness（推荐，含悬浮窗）

1. 克隆仓库：

```bash
git clone https://github.com/yts1919/research-assistant.git
```

2. 把整个 `research-assistant/` 目录放进 DSH 的 skills 目录：

```bash
# Windows
xcopy /E /I research-assistant "%USERPROFILE%\.dsh\skills\research-assistant"

# macOS / Linux
cp -r research-assistant ~/.dsh/skills/research-assistant
```

3. 配置（见下方 [⚙️ 配置](#️-配置)）。

4. 重新打开 DSH，对 Agent 说「帮我检索 xxx 的文献」即可触发。

> 悬浮窗是 DSH Web 专属增强，部署步骤见 [🪟 悬浮窗部署](#-悬浮窗部署)。

### 方式二：其他 Agent（Claude Code / Codex 等）

把 `research-assistant/` 目录放进对应 skills 目录即可，**插件本身可移植**（悬浮窗之外的功能照常以文本输出）：

| Agent | skills 目录 |
|---|---|
| Claude Code | `~/.claude/skills/` |
| Codex | `~/.codex/skills/` |
| Cursor / 其他 | 各自的 skills 目录 |

### 方式三：插件商店 CLI

```bash
npx skills add yts1919/research-assistant --skill '*' -y --copy -g
```

> 本插件是**单一 Skill**（根目录 `SKILL.md` 为路由，`skills/` 下是内部子技能）。CLI 若把子技能也当作独立 skill 列出，用根技能名 `research-assistant` 即可。

---

## ⚙️ 配置

复制示例配置并填写：

```bash
cp config.example.json config.json
```

### 需要 Key 的部分

| 功能 | 配置项 | 环境变量 | 说明 |
|---|---|---|---|
| 图像生成 | `image_gen.api_key` | `DASHSCOPE_API_KEY` / `IMAGE_GEN_API_KEY` | 文生图 / 图生图 |
| 摘要翻译 | `llm.api_key` | `DEEPSEEK_API_KEY` / `LLM_API_KEY` | 检索结果摘要中英互译 |

> ✅ 文献检索、引文格式化、分区查询**无需 Key**，直接走公开 API。

### 完整配置示例（`config.json`）

```json
{
  "image_gen": {
    "provider": "qwen",
    "base_url": "",
    "api_key": "你的图像模型 Key",
    "model": "wanx2.1-t2i-turbo"
  },
  "llm": {
    "provider": "deepseek",
    "base_url": "https://api.deepseek.com",
    "api_key": "你的文本模型 Key",
    "model": "deepseek-chat"
  },
  "search": { "translate": true, "bilingual": true },
  "panel": { "...": "指向 dsh-web-frontend/dist 的各面板 json 路径" },
  "figure": { "output_dir": "...", "json_path": "..." },
  "citation": { "json_path": "...", "formats_json": "..." }
}
```

---

## 🎨 图像生成：如何用「更好」的大模型

默认用阿里云通义万相（免费额度多、速度快）。想换**质量更好**的模型，改 `config.json` 的 `image_gen` 段即可：

### ① 通义万相（默认，DashScope）

| 模型 | 特点 |
|---|---|
| `wanx2.1-t2i-turbo` | 快，适合批量出草图（默认）|
| **`wanx2.1-t2i-plus`** | **更精细、质量更高**，适合正式配图 |

```json
"image_gen": {
  "provider": "qwen",
  "api_key": "sk-你的DashScopeKey",
  "model": "wanx2.1-t2i-plus"
}
```

### ② 硅基流动 SiliconFlow（开源大模型，FLUX / SDXL）

```json
"image_gen": {
  "provider": "siliconflow",
  "base_url": "https://api.siliconflow.cn/v1",
  "api_key": "sk-你的SiliconFlowKey",
  "model": "black-forest-labs/FLUX.1-dev"
}
```

| 模型 | 特点 |
|---|---|
| `black-forest-labs/FLUX.1-schnell` | 快（默认）|
| **`black-forest-labs/FLUX.1-dev`** | **质量更好**（推荐）|
| `stabilityai/stable-diffusion-xl-base-1.0` | 经典 SDXL |
| `Kwai-Kolors/Kolors` | 中文理解强 |

### ③ OpenAI（DALL·E 3 / gpt-image-1）

```json
"image_gen": {
  "provider": "openai",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-你的OpenAIKey",
  "model": "gpt-image-1"
}
```

### 命令行临时切换（不改配置）

```bash
python tools/image_gen.py "示意图描述" --provider siliconflow --model black-forest-labs/FLUX.1-dev --size 1024x1024
```

> 💡 图生图：`python tools/image_gen.py "改风格描述" --mode img2img --ref 参考图.png`
> 💡 提示词越具体越好（对象、风格、视角、细节），带文字的示意图优先用 Graphviz 而非文生图（文字会画错）。

---

## 📖 使用示例

对 Agent 说：

```text
「帮我检索『深度学习 故障诊断』的文献」
「把这篇 PDF 精读一下」
「写一篇关于『xxx』的文献综述」
「把这个模型的框架图画出来」
「这个 DOI 转成 GB/T 7714 格式」
「帮我按这个期刊模板改论文格式」
```

---

## 🪟 悬浮窗（DSH Web 专属）

DSH 网页界面里，各功能结果会出现在右侧悬浮窗（互斥打开 + 「科研助手」总开关整体启停）。

| 悬浮窗 | 面板脚本 | 数据 JSON | 写数据的工具 |
|---|---|---|---|
| 📚 论文（检索结果） | `web/papers-panel.js` | `papers-panel.json` | `tools/search.py` |
| 📖 精读（论文卡片） | `web/paper-panel.js` | `paper-panel.json` | `tools/paper.py` |
| 📝 综述 | `web/review-panel.js` | `review-panel.json` | `tools/review.py` |
| ✍️ 写作（分节） | `web/section-panel.js` | `section-panel.json` | `tools/section.py` |
| 🎨 图表 | `web/figure-panel.js` | `figure-panel.json` | `tools/image_gen.py` |
| 🔗 引用 | `web/citation-panel.js` | `citation-panel.json` | `tools/cite.py` |
| ✨ 润色 | `web/polish-panel.js` | `polish-panel.json` | `tools/panel.py` |
| 🔍 审稿 | `web/prereview-panel.js` | `prereview-panel.json` | `tools/panel.py` |
| 🎯 开题 | `web/proposal-panel.js` | `proposal-panel.json` | `tools/panel.py` |
| 📐 格式修改 | `web/reformat-panel.js` | `reformat-panel.json` | `tools/reformat.py` |

### 悬浮窗部署（在 DSH Web 前端 dist 里）

**一键部署（推荐）**：把插件装到 skills 目录后，进入插件目录运行部署脚本，自动完成复制 js + 注入 index.html + 配置路径：

```bash
cd ~/.dsh/skills/research-assistant   # 或你的安装目录

python deploy.py                      # 自动查找 DSH 前端 dist
# 或手动指定：python deploy.py --dist <dsh-web-frontend/dist 的完整路径>
```

Windows 用户可直接双击 `deploy_windows.bat`。

**手动部署**（脚本不可用时）：

1. `config.json` 的 `panel` 段填好各 `*_json_path`（指向 DSH 前端 `dist/`）；
2. 把 `web/` 下所有 `.js` 复制到 `dsh-web-frontend/dist/`；
3. 在 `dist/index.html` 的 `</body>` 前注入脚本，**`dsh-panels-core.js`、`dsh-export.js` 必须排最前**：

```html
<script defer src="/dsh-panels-core.js?v=1"></script>
<script defer src="/dsh-export.js?v=1"></script>
<script defer src="/papers-panel.js?v=1"></script>
<!-- 其余 panel 脚本同理 -->
```

4. 强刷（Ctrl+F5）网页。

> 💡 各悬浮窗「导出」都支持 **Word / LaTeX / Markdown**；`dsh-export.js` 提供共享的纯前端 docx/latex 生成器。

---

## 📁 目录结构

```
research-assistant/
├── SKILL.md                 # 主入口（路由 10 个子技能）
├── skills/                  # 子技能（每个含 SKILL.md）
├── tools/                   # 底层 Python 脚本（9 个）
├── web/                     # DSH 悬浮窗脚本（10 面板 + core + export）
├── data/                    # 期刊分区数据（中科院/JCR/SJR + 中文刊名对照）
├── config.example.json      # 配置模板（空占位符）
├── requirements.txt         # Python 依赖
├── deploy.py                # 一键部署悬浮窗（跨平台）
├── deploy_windows.bat       # Windows 双击部署
├── .gitignore
└── LICENSE
```

---

## 🔒 安全说明

- 仓库只含 `config.example.json`（空占位符），**不含任何真实 API Key**；
- 本地配置放 `config.json`，已被 `.gitignore` 排除，**不会上传**。

---

## 📄 许可证

[MIT](./LICENSE)
