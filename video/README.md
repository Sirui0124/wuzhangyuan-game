# 视频素材

- `current/`：当前构建白名单的四段视频。两段 legacy-fallback 仍有实际引用。
- `pending/`：14.25 秒开场前半，也是最新 SC01 剪辑的源片，保留。
- `in-progress/raw/`：现用与在制的新原片。
- `in-progress/references/`：当前在制视频的人物、场景参考图，不含生图 Prompt。
- `in-progress/edits/`：最新优选的六段剪辑；`manifest.json` 记录现有相对路径、时间线、哈希及待听审状态。

实际播放以 `GameStarter/web-demo/public/cinematics.json` 和 `public/video/media-manifest.json` 为准。在制素材不会自动进入游戏；六段剪辑仍需人工听审与接入验收。历史审片包、旧版序章与被替代的原片已移入本机废纸篓。
