# 游戏原声复刻选材

用户已确认素材为其自行生成且允许复刻。2026-10-23执行。当前未修改游戏音色、剧情、视频或正式存档。

原片路径、SHA256、时码和指标见 selection.json。玩家取 C1T08 1.70–6.10 / 12.05–21.85，避开甲的插话；魏延取 C1T05 10.70–29.85，避开 A-29 后续通用音色补录。采用原片原速音轨，不从 TTS 修补片段循环复刻。

依据为 video/review/20261023-process 逐字转录及现行剧情说话人映射。ASR有同音字错误，不作为人工核准转录；没有把字幕草稿当成成片转录。源片截图辅助核对；玩家第一段为死亡黑屏，身份依赖独白与剧情映射。主观噪声、音色一致性和表演适配仍需试听，未声称人工听审。

24kHz、16bit、mono，仅切口8ms淡入淡出，不变速、不变调。玩家14.2秒、魏延19.15秒，均无削波。原片环境音保留；注册请求 enable_audio_denoise=true，可能牺牲部分声线细节。

注册接口 https://openspeech.bytedance.com/api/v3/tts/voice_clone 使用本机密钥、后付费自定义临时ID和 extra_params.demo_text，未调用正式合成。结果在 outputs/tts-demo/clone/registration.json。玩家注册返回HTTP403/code45000030：volc.megatts.timbre requested resource not granted。需账号开通/授权声音复刻；普通TTS成功不代表复刻权限通过。

官方依据：
- https://docs.volcengine.com/docs/DoubaoVoice/tone-training-http?lang=zh
- https://docs.volcengine.com/docs/DoubaoVoice/SoundReplication20BestPractices?lang=zh
- https://docs.volcengine.com/docs/DoubaoVoice/Billinginstructions-21?lang=zh

后付费注册试听不触发槽位费，试听字符按模型收费；首次正式合成将固定音色并按公开价收取138元/音色，两个276元（以账号实际权益为准）。先交付试听、明确费用再进行该步。目前未测流式延迟，注册耗时不能充当首包延迟。
