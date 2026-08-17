---
name: research-assistant
description: 科研助手插件：文献检索、论文精读、文献综述、分节写作、图表生成、引文管理、学术润色、预投稿审稿、开题方案、格式修改。当用户需要做科研相关任务（找文献、读论文、写综述、画图、管引用、润色、审稿、开题、改格式）时使用。
---

# Research Assistant 科研助手

一个面向本科生/研究生/博士生的科研全流程助手。**不是「一键生成论文」，而是分步辅助 + 人在环**：每步产出可审查、可返工的中间结果。

## 何时使用

当用户提出以下任一类需求时，加载本技能并路由到对应子技能：

| 用户需求 | 路由到 |
|---|---|
| 找文献、搜论文、查某主题的论文 | `skills/literature-search` |
| 读一篇论文、总结、精读、做笔记 | `skills/paper-reading` |
| 写文献综述、调研报告、研究现状 | `skills/literature-review` |
| 写某一部分（引言/方法/讨论）、起草段落 | `skills/section-writing` |
| 画图、示意图、流程图、数据图 | `skills/figure-generation` |
| 引用格式、GB/T 7714、参考文献管理 | `skills/citation` |
| 润色、改写、翻译成学术英文 | `skills/academic-polishing` |
| 模拟审稿、预投稿评估 | `skills/pre-review` |
| 开题报告、研究方案、立项书 | `skills/proposal-writing` |
| 改论文格式、套模板、排版规范 | `skills/format-reformat` |

## 使用方式

1. 先读对应子技能的 `SKILL.md`，严格按其工作流执行。
2. 底层用 `tools/` 里的脚本干活：`search.py`（文献检索）、`image_gen.py`（图像生成）、`cite.py`（引文格式化）、`reformat.py`（格式修改）。
3. 用户首次使用前需配置 API Key：复制 `config.example.json` 为 `config.json` 并填写（或用环境变量）。

## 核心原则

- **真实来源优先**：检索真实文献，不编造引用；
- **人在环**：每一步产出后让用户审查、反馈、迭代；
- **输出可直接使用**：返回可粘贴文本、BibTeX、图片文件等，而非空泛结论；
- **诚实**：不确定处明确标注，不假装知道。
