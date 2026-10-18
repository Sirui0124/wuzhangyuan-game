# 五丈原网页游戏

在工作区根目录 `npm ci` 后运行 `npm start`，打开 http://127.0.0.1:8811 。安装、AI 代理与验证命令见[根 README](../../README.md)，Windows 操作见[迁移指南](../../docs/migration/WINDOWS.md)。

`src/` 是交互实现，`public/` 是网页与发布资源。剧情由 `../../content/chapters/wuzhang/chapter.json` 提供；美术由 `visual-assets.json` 指向 `../../source-art/visuals/runtime/`；当前四段视频由 `public/cinematics.json`、`public/video/media-manifest.json` 从 `../../video/current/` 选择。

构建输出 `.build/` 可再生成，不进入 Git。在制视频单独保存在 `../../video/in-progress/`，尚未接入。首轮“转呈未竟”使用对白表达问责，不播放旧教学牺牲影片。Cocos 编辑器与原生应用需独立验收。
