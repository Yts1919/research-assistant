---
name: figure-generation
description: 生成科研图，支持 6 种方式：文生图、图生图、AI 代码绘图、矢量图、流程图/框架图/关系图、仿真图。当用户需要画图、示意图、数据图、流程图时使用。
---

# 图表生成 (figure-generation)

## 6 种方式与选择

| 方式 | 适用 | 用什么 |
|---|---|---|
| 文生图 | 概念图、场景示意图 | `tools/image_gen.py`（图像大模型） |
| 图生图 | 有参考图要改风格 | `tools/image_gen.py --mode img2img` |
| AI 代码绘图 | 有数据 → 柱/折线/散点/热力图 | 主 LLM 写 matplotlib 代码 |
| 矢量图 | 结构示意图（要矢量） | matplotlib 输出 SVG |
| 流程图/框架图/关系图 | 流程、架构、关系 | Graphviz（已装，文字准确） |
| 仿真图 | 波传播、粒子运动、衰减曲线 | 主 LLM 写数值仿真代码 |

## 工作流

1. 判断图属于哪一类，选对应方式。
2. 文生图 / 图生图（走图像大模型）：
   ```bash
   python tools/image_gen.py "描述" --size 1024x1024 [--provider qwen --model wanx2.1-t2i-turbo]
   python tools/image_gen.py "描述" --mode img2img --ref 参考图.png
   ```
   - 生成后自动保存到 `figure.output_dir` 并更新右侧「图表」面板（`figure.json_path`）；
   - 主模型（deepseek-v4-pro）不能生图/看图，图像生成由配置的图像大模型完成（本地默认阿里云通义万相，用户可在面板切换 OpenAI / 硅基流动）。
3. 代码绘图 / 矢量图 / 仿真图：让主 LLM 写 matplotlib 代码，`exec` 执行后保存 PNG/SVG。
4. 流程图：让主 LLM 写 Graphviz DOT 代码，`graphviz.Source(dot).render(...)` 出图。

## 与「图表」悬浮窗的交互

- 面板提供「模型选择 + 尺寸 + 提示词」，因为浏览器不能安全持有 API Key，图像生成在服务端完成；
- 用户在面板选好模型、填好提示词，点「生成（复制给 AI）」把请求复制到剪贴板，粘贴给 AI；
- AI 按请求跑 `image_gen.py`（用面板选的模型/尺寸），图片写入 `figure.output_dir`、面板 JSON 更新，悬浮窗自动展示；
- 生成的图都在悬浮窗里可查看、按时间倒序排列。

## 注意

- 流程图/框架图优先 Graphviz（文字准确）；带文字的示意图不适合文生图（文字会画错）；
- 数据图标注 n、误差棒定义、单位；
- 文生图提示词要具体（对象、风格、视角、细节），避免含糊。
