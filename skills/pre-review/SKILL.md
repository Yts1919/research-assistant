---
name: pre-review
description: 从审稿人视角模拟预投稿评审：输出三份互盲 reviewer reports + 综合意见，检查手稿内部一致性。当用户需要预投稿评估、审稿意见模拟时使用。
---

# 预投稿审稿 (pre-review)

## 工作流

1. 拿到稿件（全文/摘要/关键章节）。
2. 扮演三位互盲审稿人，各自独立评审：
   - **Reviewer 1**：关注方法与严谨性；
   - **Reviewer 2**：关注新颖性与意义；
   - **Reviewer 3**：关注结果与呈现。
3. 每位审稿人输出：
   - 总体评价（一句话）
   - 主要优点
   - Major 意见（编号列出）
   - Minor 意见（编号列出）
   - 推荐结论（接受 / 小修 / 大修 / 拒稿）
4. 三位写完后，再给一段「综合评审意见」总结共同关注点。

## 原则

- 三位互不参考、互不引用；
- 只基于给定文本评审，不编造稿件中不存在的内容；
- 检查手稿内部一致性（术语、数值、图表与正文是否矛盾）；
- 意见要具体可执行，不是泛泛的「写得不错/不够好」。

## 与「审稿」悬浮窗的交互

- 面板提供：稿件输入、开始审稿、导出、清空；三位审稿人报告可点击标题折叠/展开；
- 用户点「开始审稿」把稿件复制给 AI；AI 完成三份报告 + 综合意见后写成 JSON 写回面板：
  ```bash
  python tools/panel.py --panel prereview --file review_out.json
  ```
  JSON 结构：`{"reviews":[{"reviewer":"Reviewer 1","focus":"方法与严谨性","verdict":"大修","overall":"…","strengths":"…","major":["…"],"minor":["…"]}],"summary":"…"}`
- 面板轮询 `/prereview-panel.json` 展示三份报告 + 综合意见；「导出 Markdown」下载 `预投稿审稿.md`；「清空」复制指令给 AI 执行 `panel.py --panel prereview --clear`。
