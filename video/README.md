> 迁移说明：最新未验收原片在根目录 `../video-new/`。当前构建仅使用 `current/` 的四段白名单视频；legacy fallback 仍在使用。其他历史接入记录保留备查。

# 五丈原视频目录

- `current/`：全部正在应用的4条媒体：新EN01、新03，以及文件名标明legacy-fallback的旧版临时开场/结尾。
- `pending/`：待补魏延的14.25秒开场前半，未进入游戏。
- `fallback/`：已停止作为活跃媒体目录，原两条媒体已原样迁至current。
- `video-new/`：原始视频及参考PNG，除明确删除的EN02A外保留到剪辑验收完成。
- `legacy/`：原public/video的四条旧MP4原件，已脱离现行引用，保留供恢复/历史核对。

游戏的真实引用以`GameStarter/web-demo/public/cinematics.json`和`video/media-manifest.json`为准。构建只复制白名单current，不扫描整目录。

本轮剪辑、时间码、废纸篓恢复路径、Library附件和验证详见`../outputs/视频剪辑整理_20261016/交付报告.md`。EN02A已通过系统废纸篓可恢复删除；未清空任何素材目录。
