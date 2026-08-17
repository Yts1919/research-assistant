---
name: academic-polishing
description: 学术润色：把中文学术文本或粗糙英文润色/翻译成 Nature 风格英文，扫描术语、单位、数值精度与声称漂移。当用户需要润色、改写、翻译学术段落时使用。
---

# 学术润色 (academic-polishing)

## 核心：先诊断，再润色

**不要一上来就改句子。** 先判断这段文字的主要问题，按优先级处理：

```
论文类型 → 章节任务 → 段落逻辑 → 论证/证据/边界 → 句子润色
```

- 论证断了、章节任务错了，先修结构，不润色句子；
- 句子本身没问题就别动。

## 润色规则

1. **术语账本**：术语、缩写、单位、符号全文一致，不为「换词」引入同义词；
2. **简洁精准**：删冗余、短句优先、一词一义；
3. **主动语态优先**；
4. **动词校准**：show/demonstrate vs suggest/may；
5. **删除无据声明**：first/unprecedented/revolutionary 等；
6. **避免破折号（em dash）**：用逗号、括号或句号。

## 输出

- 只输出润色后的文本 + 文末简列主要修改；
- **不发明数据、结论或引用**；若发现论证缺陷，指出来而不是用漂亮话掩盖。

## 与「润色」悬浮窗的交互

- 面板提供：方式（润色/改写/翻译成英文/中译英）、风格（Nature 风格/简洁精准/学术严谨/保持原意）、原文输入、润色、导出、清空；
- 用户点「润色」把【方式+风格+原文】复制到剪贴板粘贴给 AI；AI 润色后，把结果写成 JSON 写回面板：
  ```bash
  # 先写一个 JSON 文件（顶层 items 数组），再写入面板
  python tools/panel.py --panel polish --file polish_out.json
  ```
  JSON 结构：`{"items":[{"mode":"润色","style":"Nature 风格","original":"…","polished":"…","changes":["…"]}]}`
- 面板轮询 `/polish-panel.json` 展示「原文 → 润色后 → 主要修改」；「导出 Markdown」下载 `润色结果.md`；「清空」复制指令给 AI 执行 `panel.py --panel polish --clear`。
