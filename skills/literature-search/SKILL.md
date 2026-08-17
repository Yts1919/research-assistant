---
name: literature-search
description: 跨 arXiv / OpenAlex / CrossRef / Semantic Scholar / PubMed / DBLP / 谷歌学术镜像 / CORE 检索真实学术论文；知网与谷歌学术镜像提供跳转链接。当用户需要找文献、搜论文、查某主题的论文时使用。
---

# 文献检索 (literature-search)

## 工作流

1. 明确用户的检索主题/关键词（若太宽泛，先问清：学科？时间范围？中英文？）。
2. 调用 `tools/search.py` 检索：
   ```bash
   python tools/search.py "关键词" --sources arxiv,openalex,crossref,semantic_scholar,pubmed,dblp,scholar --max 10 --format json
   ```
   - 默认已含 `scholar`（仅走谷歌学术镜像，不直连官方）；`search.bilingual: true` 时自动加中/英对照关键词检索，提升中文文献命中。
3. 汇总结果：按被引数排序、去重，列出标题/作者/年份/来源/DOI。
4. 按需导出 BibTeX / RIS / CSV（`--format bibtex|ris|csv`）。
5. 找某篇论文的相似/相关论文：`python tools/search.py --related "DOI" --max 10`（Semantic Scholar 推荐，失败自动回退按标题检索）。

## 数据源说明

| 源 | 说明 |
|---|---|
| `arxiv` | 数理/CS/物理，最快 |
| `openalex` | 全量引文图谱，含开放获取信息 |
| `crossref` | DOI 权威元数据 |
| `semantic_scholar` | 带摘要 |
| `pubmed` | 生物医学 |
| `dblp` | 计算机科学文献库 |
| `scholar` | 谷歌学术镜像（尽力而为，镜像地址可能变动） |
| `core` | 开放获取论文库 |

## 无公开 API 的源（跳转链接）

`search.py` 的 text 模式会自动输出以下跳转链接：
- **知网 CNKI**：知网无公开 API，提供 `https://kns.cnki.net/kns8s/defaultresult/index?kw=<关键词>` 跳转链接。

> 谷歌学术镜像已作为数据源直接抓取（`scholar`），不再需要跳转链接。

## 右侧论文面板（DSH Web 专属）

在 DeepSeek Harness 网页界面使用时，检索结果会自动出现在右侧面板：

- `search.py` 把结果写成 JSON（路径来自 `config.json` 的 `panel.json_path`，指向 `dsh-web-frontend/dist/papers-panel.json`）；
- 网页注入了 `papers-panel.js`（源码在插件 `web/` 目录），每 2.5 秒轮询该 JSON，在右侧渲染论文卡片：标题链接、作者/年份/来源/被引、摘要（展开）、翻译（EN↔CN，用 `llm` 配置的文本模型在检索时翻好，按钮仅切换）、PDF/原文、BibTeX 复制；
- 卡片上的增强操作：**引文**（前端直接生成 GB/T 7714 复制到剪贴板）、**精读**（复制指令给 AI 写入精读面板）、**总结**（复制指令给 AI 一句话总结）、**相关**（复制指令给 AI 检索相似论文）、**作者/期刊点击**（复制指令再检索该作者/期刊）；
- 面板顶部还有：批量勾选导出（GB/T 7714 引文 / BibTeX / RIS）、排序（被引/年份）、只看免费 PDF、起始/截止年份筛选、检索历史（本地保存，可点选重新检索）；
- 未配置 `panel.json_path` 时不影响命令行输出。

> 面板是 DSH Web 专属增强，不是跨 Agent 的便携能力；Claude Code / Codex 等其它宿主仍以文本输出。

## 注意

- 全部来自公开 API，结果真实可追溯；
- 若某源报错（如限流/被墙），自动跳过并说明，不影响其他源；
- 谷歌学术镜像可能不稳定，属于「尽力而为」。

