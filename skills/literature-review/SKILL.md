---
name: literature-review
description: 检索 + 分主题综合，生成带真实引用的文献综述草稿（含核心文献对比表、研究空白归纳、引用检查、草稿续写、导出），展示在右侧「综述」悬浮窗。当用户需要写文献综述、调研报告、研究现状时使用。
---

# 文献综述 (literature-review)

## 工作流（两段式）

1. 明确主题与研究范围。
2. 检索真实文献：
   ```bash
   python tools/search.py "主题" --sources arxiv,openalex,crossref,semantic_scholar,pubmed,dblp,scholar --max 15 --format json
   ```
3. **领域概况统计**（作引言素材）：
   ```bash
   python tools/review.py --stats
   ```
4. **分主题聚类 → 生成大纲 → 用户确认**：按「主题 / 方法 / 时间线」分组，产出大纲写入「综述」悬浮窗，等用户确认后再逐节写。
5. **逐节撰写**，正文用 `[1][2]` 编号标注，与文末参考文献一一对应，只用真实文献。
6. **引用完整性检查**（写完必做）：
   ```bash
   python tools/review.py --check review.json
   ```
7. **参考文献转 GB/T 7714**：
   ```bash
   python tools/review.py --refs review.json
   ```
8. **草稿保存 / 续写**：
   ```bash
   python tools/review.py --save review.json --out 综述_主题.json   # 保存草稿
   python tools/review.py --load 综述_主题.json                    # 载入草稿继续写
   ```
9. **导出**：
   ```bash
   python tools/review.py --export review.json --format md --out 综述.md
   python tools/review.py --export review.json --format docx --out 综述.docx
   ```

## 综述结构

- 引言（领域背景 + 综述范围 + 领域概况统计）
- 分主题小节（每个主题：关键工作 → 方法对比 → 递进关系）
- **核心文献对比表**（表格：文献 / 方法模型 / 数据对象 / 评价指标 / 主要局限）
- **研究空白与切入点**（现存争议、未解决问题、与「你」的研究衔接点）
- 未来方向
- 结论

## 写入悬浮窗

- 综述 JSON 结构：`title` + `sections`（数组）+ `table`（可选，`{title, columns, rows}`）+ `references`（数组）；
- 用 `tools/paper.py --write-card --panel <config.review_json_path>` 写入右侧「综述」面板（720px，带收起、导出按钮）。

## 原则

- 突出「脉络」而非「清单」：讲清楚工作之间的继承、改进、分歧；
- 每个观点要有文献支撑，不编造引用；
- 对比表要「横向可比」，同一列用同一口径；
- gap 归纳要具体（哪个问题、为什么难、可能的方向），不要空泛；
- 两段式：先大纲后正文，人在环。
