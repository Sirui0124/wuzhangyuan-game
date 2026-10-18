# 现用音效来源

`originals/` 只保留 `prepare-sfx.py` 实际使用的 11 个 Kenney CC0 OGG 原件及两个 License.txt。`audio-design-manifest.json` 记录 12 个发布音效的来源、加工参数与 SHA-256；两个点击音共享原始采样。许可也随发布文件保存在 `GameStarter/web-demo/public/audio/licenses/`。

可选加工脚本需要 FFmpeg，会在本目录生成被 Git 忽略的 sfx/ 输出。游戏直接读取 public/audio/sfx，不依赖试听页、下载 ZIP 或完整音效包。
