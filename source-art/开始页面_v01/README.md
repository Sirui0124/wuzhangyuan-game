# 逆转五丈原 · 开始页面 v01

2026-10-11。主菜单实装在 `GameStarter/web-demo`，四个按钮为新游戏、读取存档、设置、结局成就；新游戏常态高亮。

背景采用内置 image_gen，原始图为「七星灯_主菜单背景_v01.png」，完整提示词见「生成提示词.md」。以帐内灯火、羽扇竹简和帐外军营呈现电影感历史夜色，菜单文字由 HTML 渲染。网页资源为 `GameStarter/web-demo/public/main-menu-background-v01.jpg`（同图 JPEG 编码，约 387 KB）。

`app.before.ts`、`ending-album.before.ts` 和 `index.before.html` 为动工前检查点；共享工作区后续并行修复已保留，检查点不用于整体覆盖恢复。

浏览器验证报告及最终截图位于 `GameStarter/web-demo/verification/main-menu/`。通过桌面两种尺寸、窄屏及白模入口的菜单交互；类型构建通过。没有改 Cocos 主场景或剧情文本。
