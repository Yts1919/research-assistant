---
name: citation
description: 引文管理：DOI/标题转标准引文格式（GB/T 7714、APA、IEEE、MLA）、参考文献真实性校验。当用户需要格式化引用、整理参考文献时使用。
---

# 引文管理 (citation)

## 工作流

1. 拿到 DOI 或文献标题。
2. 格式化引文：
   ```bash
   python tools/cite.py "10.xxxx/xxxx" --style gb7714   # 或 apa / ieee / mla
   python tools/cite.py "10.xxxx/xxxx" --style gb7714 --add   # 同时加入引文面板
   ```
3. 若只有标题没有 DOI，先用 `tools/search.py "标题" --sources crossref --max 1` 找到 DOI，再格式化。
4. 批量扫描文件夹/PDF（可多个路径，自动读前 2 页抓 DOI → 转引文 → 加入面板；文件夹里只取 .pdf 论文）：
   ```bash
   python tools/cite.py --scan "D:\edge" --style gb7714
   python tools/cite.py --scan "D:\edge" "D:\paper1.pdf" "D:\paper2.pdf" --style gb7714   # 多个路径一次生成
   python tools/cite.py --scan "D:\edge" --template "{authors}. {title}[J]. {journal}, {year}, {volume}({issue}): {pages}."
   ```
5. 自定义引文格式（占位符 `{authors}/{title}/{year}/{journal}/{volume}/{issue}/{pages}/{doi}`）：
   ```bash
   python tools/cite.py --save-format --name "中文期刊" --template "{authors}. {title}[J]. {journal}, {year}, {volume}({issue}): {pages}."
   python tools/cite.py --list-formats          # 列出已保存格式
   python tools/cite.py --remove-format --name "中文期刊"
   ```
6. 引文面板维护：
   ```bash
   python tools/cite.py --remove 2      # 删除面板第 3 条（0 起）
   python tools/cite.py --clear         # 清空面板
   ```

## 与「引用」悬浮窗的交互

- 面板提供：方式切换（DOI 输入 / 文件文件夹扫描）、引文格式选择、已保存格式下拉、自定义模板、「识别格式」、添加引用、导出、清空；
- 浏览器不能直接调 CrossRef，故「添加引用 / 扫描」把请求复制到剪贴板，粘贴给 AI，AI 跑 `cite.py --add` / `cite.py --scan` 格式化并写入 `/citation-panel.json`，面板自动展示编号引文列表；
- 「识别格式」：用户在输入框粘贴一段标准引文，点按钮复制给 AI，AI 识别其排版规则 → 生成模板 → `cite.py --save-format` 保存，之后可从「已保存格式」下拉选用（从 `/custom-formats.json` 加载）；
- 面板「导出 Markdown」把列表下载为 `参考文献.md`；「清空」复制指令给 AI 执行。

## 常用格式（完整模板，含卷/期/页码）

- **GB/T 7714**（中文期刊/毕业论文标准）：`作者. 标题[J]. 期刊, 年份, 卷(期): 页码. DOI:xxx.`
- **APA 7th**（英文最常用）：`Author, A. A., Author, B. B., & Author, C. C. (Year). Title. Journal, Volume(Issue), pages. https://doi.org/xxx`
- **IEEE**（工程/计算机）：`A. Author, B. Author, and C. Author, "Title," Journal, vol. X, no. Y, pp. Z-Z, Year, doi: xxx.`
- **MLA**（人文）：`Author, A. A., Author, B. B., and Author, C. C. "Title." Journal, vol. X, no. Y, Year, pp. Z-Z.`

> 引文从 CrossRef 抓取卷/期/页码，字段齐全、不残缺；「引用」悬浮窗会根据所选格式显示对应模板作参考。

## 参考文献真实性校验

- 用户给一串文献（标题或 DOI）要你「查是否真实存在」：
  1. DOI → `tools/cite.py` 若能解析即为真；
  2. 标题 → `tools/search.py "标题" --sources crossref --max 1` 看能否匹配到。

## 原则

- 只用真实可查的文献，不编造引用；
- 中文论文引用格式默认 GB/T 7714；英文期刊按目标期刊要求。
