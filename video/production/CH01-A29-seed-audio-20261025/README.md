# A-29 玩家画外配音修订 · 待用户试听

用户反馈：截图中“将军留步，帐前有禁令，今夜非要事不得入”的配音有问题，要求豆包语音API、用之前的音色作参考。

- 实际调用：豆包 `seed-audio-1.0`，`POST https://openspeech.bytedance.com/api/v3/tts/create`。参考文件以真实Base64提交于 `references[0].audio_data`，未选预设speaker。
- 参考原件：`source-art/audio/voice-clone/20261023/player-reference.wav`，来源是用户此前自生成影片中的“我”的原声。没有用本次有问题的通用TTS补录做参考。
- 唯一发声原句：“将军留步，帐前有禁令，今夜非要事不得入。” 控制说明与原句在请求中区分。完整Prompt、参考哈希、请求ID及返回字幕保存在 `generation.json`，不保存密钥或Base64请求体。
- 新配音：`A-29-player-seed-audio-v1.wav`（4.3秒）；混音用 `A-29-player-seed-audio-matched.wav`，保留完整录音，不变速、不变调，仅匹配音量和8毫秒接缝淡化。
- 当前影片：`video/current/C1T05-05-A29-seed-audio-20261025.mp4`（29.875秒）。保留最新QA版活体闭口倾听镜头，视频压缩数据逐包完全一致，没有冻结或补画面。旧QA版文件原样保留。
- 旧补录通过与原TTS波形相关定位至5.249秒，相关系数0.99766；只清除其所在区间，5.25秒插入新配音。其余时间魏延与环境声在重编码前PCM不变，AAC重编码后相关系数0.99988。
- 字幕只更新A-29起止，字幕文件 `GameStarter/web-demo/public/video/subtitles/C1T05-05-A29-seed-audio-20261025.vtt`。播放配置与资源清单已按旧值比较后更新，旧绑定留存在 `previous-runtime-binding.json`。

新音轨ASR识别出完整三分句，无角色名/导演说明额外朗读；“账/帐”为同音识别差异。ASR只辅助定位，不代表逐字听审或用户批准。全片解码、画面逐包保留与其他音轨区间校验通过；构建通过。浏览器实际播放与服务文件哈希结果见 `browser-verification.json`。

官方接口依据：[豆包音频生成HTTP](https://docs.volcengine.com/docs/DoubaoVoice/audio-generation-http?lang=zh)。本版待用户试听确认。
