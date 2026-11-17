# 证据物品阅读界面 · 2026-10-25

用户要求：证据文字以专属物品UI展示，物品上的字可以连笔或繁体，下方用对话框展示文字。

## 已实现

- 第二章13处实体材料使用上方物品、下方水墨对话框的布局；信札、账页、报告按节点明确映射，账页增加分栏线，使用竖排繁体字。
- 物品使用生成的透明纸张底图。装饰书写与原文分开，完整原文直接取现有节点文本，保留换行、滚动阅读与“读完继续”。不添加未知数量、印章或新证据事实。
- `UI-GRAIN-FLOW`是说明文字，沿用下方阅读框，不伪装成实体原件；共同补报的可编辑寄信页保留原功能。
- 剧情、线索授予时机和存档版本未修改。信纸文字按纸面尺寸及列长度缩放，避免长回信截字。

## 文件

- 物品映射：`GameStarter/web-demo/src/chapters/chapter-two/materials.ts`
- 阅读布局：`GameStarter/web-demo/src/game/material-view.ts`
- 样式：`GameStarter/web-demo/public/evidence-material.css`
- 美术原件：`source-art/visuals/runtime/ui/evidence/evidence-paper-v1.png`
- 发布底图：`GameStarter/web-demo/public/ui/evidence-paper-v1.png`
- 完整生成Prompt及工具：`source-art/visuals/runtime/ui/evidence/evidence-paper-v1.json`（内置image_gen，透明背景）

## 实际验证

在线协作原则修订35已读取，Markdown正文与本地副本去除首尾空白后一致，无须改写。留存 `outputs/evidence-ui-20261025/principles-live.json`。

类型与架构检查、构建通过。第二章影片流程4项现有测试通过，包括阅读前不提前发线索。独立Chrome上下文检查14个材料/说明节点 × 4个尺寸（1366×768、1920×1080、390×844、844×390），共56个页面状态，验证原文一致、底图加载、按钮可见、上下区无重叠、竖排字无截断，及阅读继续、刷新恢复、打开线索时空格不推进。报告和截图：`outputs/evidence-ui-20261025/`。检查了信件、长回信、账页的实际截图。沿用的章节影片烟雾脚本已更新阅读区选择器，本轮未重跑全章影片浏览器流程。

本机8812服务已就绪，提供的样式和渲染模块与最终源码构建一致。浏览器验证不代表用户审核；视觉效果待用户试玩。Cocos编辑器与原生端未验证。
