# 开始页面 v03：位置调整

- 定制字标整体向左移动 10vw。
- 删除「一夜之间 · 改写天命」。
- 四个按钮保留 30vw 宽度，水平居中于桌面屏幕（35vw—65vw），整体比上一版上移 10svh。
- 保留高亮「新游戏」、已有背景和 v02 按钮美术。窄屏保持原有自适应排布。

已完成 HTML 试玩编译，以及主菜单、读取存档、设置和结局成就的六组浏览器流程验证；1672×941、1280×720 桌面位置与原版坐标对比通过，390×844 窄屏无溢出。

验证记录：`../../GameStarter/web-demo/verification/main-menu/report.json`、`layout-v03-report.json`。
最新桌面截图：`../../GameStarter/web-demo/verification/main-menu/menu-art-v03-1672.png`。

`app.before.ts` 和 `main-menu.before.css` 是本轮修改前的参考快照；多人并行开发时不要整文件恢复。


2026-10-13 清理更新：被替换和废弃的素材、旧方案及旧代码快照已按用户要求永久删除；上文历史描述中的保留/恢复说明不再适用于已删除文件。现存目录以 source-art/素材目录索引.md 和本次废弃材料删除清单为准。
