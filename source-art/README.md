# 游戏源素材

- `visuals/runtime/`：当前人物、场景、镜头与界面美术原件；绑定以 `GameStarter/web-demo/visual-assets.json` 为准。
- `audio/bgm/originals/`：四首当前音乐的原 MP3；`processing.json` 记录加工参数、来源与发布 WAV 哈希。
- `audio/sfx/originals/`：实际使用的 Kenney CC0 音效原件及许可；`audio-design-manifest.json` 记录出处与处理参数。
- 发布音频统一在 `GameStarter/web-demo/public/audio/`；在制视频及其人物参考图在 `video/in-progress/`。

图片生成 Prompt、旧版参考图、研究影片、历史生成记录及试听副本已移出当前目录。音频加工 Python 脚本是可选工具，需要 FFmpeg，普通安装与构建不会运行它们。
