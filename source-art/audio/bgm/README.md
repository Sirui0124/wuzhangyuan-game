# 现用音乐来源

`originals/` 是当前四首音乐的原始 MP3，`processing.json` 给出来源、裁切、循环、音量与发布 WAV 的 SHA-256。游戏加载 `GameStarter/web-demo/public/audio/bgm/`，不依赖 prepared / previews 副本。

可选 `python3 prepare-bgm.py` 使用 FFmpeg 重新加工并更新发布音频，会在本目录生成被 Git 忽略的 prepared / previews 临时副本；无需在安装或迁移时运行。音乐由用户提供，保留私有项目用途，不据此推定公开再分发许可。
