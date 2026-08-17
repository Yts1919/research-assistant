---
name: format-reformat
description: 格式修改：按目标期刊/学校模板或用户文字要求，把用户的论文（多为 Word 文档）重排格式，支持预览、迭代修改与导出 Word/LaTeX/Markdown。当用户需要改论文格式、套模板、排版规范时使用。
---

# 格式修改 (format-reformat)

## 工作流

1. 拿到两个输入：
   - **格式要求**：期刊/学校模板文件或文件夹，或用户文字描述的格式规定（字体、字号、行距、页边距、参考文献格式、图表规范等）；
   - **论文**：用户的论文文件（多为 Word `.docx`，也可能 `.tex`/`.md`/`.txt`，或一个文件夹）。
2. 读取内容（纯标准库，不依赖 python-docx/lxml）：
   ```bash
   python tools/reformat.py --read "D:\模板" "D:\论文.docx"
   ```
   - 逐文件打印正文前 8000 字，用于理解格式规范与论文原文。
3. 按格式要求重排论文（标题层级、字号/行距/页边距措辞、图表编号、参考文献 GB/T 7714、段落结构等），输出为 Markdown。
4. 写入右侧面板：
   ```bash
   # 先写一个结果 JSON，再写入面板
   python tools/reformat.py --write 结果.json
   ```
   结果 JSON 结构：`{"title":"论文标题","preview":"修改后的正文(Markdown)","note":"修改说明"}`
5. 用户在悬浮窗预览；若继续提要求，按追加要求再次修改并写回面板。

## 与「格式」悬浮窗的交互

- 面板提供：①格式要求（模板/文件夹路径 或 文字要求）②论文路径 ③「开始修改」④「继续修改（追加要求）」⑤预览框 ⑥下载 Word/LaTeX/Markdown ⑦清空；
- 「开始修改 / 继续修改」把请求复制到剪贴板，粘贴给 AI，AI 读取并重排后写回 `/reformat-panel.json`，面板自动预览；
- 预览满意后，用户点「下载 Word / LaTeX / Markdown」导出（前端生成 .docx/.tex/.md）。

## 原则

- 忠实于用户给的格式规范，不臆造规则；
- 只改格式与表述，不改动论文的事实、数据、结论；
- 输出 Markdown 供预览与三种格式导出（Word/LaTeX/Markdown 均从同一份 Markdown 生成）。
