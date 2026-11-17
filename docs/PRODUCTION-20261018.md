> **2026-10-21 制作状态更新：** 本文旧状态为历史/现片快照。新制作统一见 `video/production/CURRENT-20261021/README.md` 与 `docs/video/review-20261021/REVIEW.md`。14条新版视频仍待生成，LI02B已扩展为画面重做；EN02B-B仍取消，LI02A仍保留。现用播放继续按游戏清单。

> **S7 最新状态：** PR01B、LI01R已在前导空格目录找到并合并。完整新开篇54.542秒正式接入；LI01 26.667秒接章节预览，源2.250—3.500秒局部2×已完成，缩短0.625秒。旧缺文件/旧开篇回退状态已失效。LI02B仍待字节API配置/生成且未剪尾；EN02B-B取消。最新采用与证据见[接入报告](video/INTEGRATION-20261018.md)；下方S1—S6保留历史。

> 最新实际状态见 [正式接入与剩余阻塞](video/INTEGRATION-20261018.md)。本轮用户已授权正式绑定，旧“仅待审/不改绑定”限制已失效；EN02B-B 用户取消、不再补拍。历史生成状态不可代替实际文件清单。

# 制作与素材索引 · 2026-10-18

本文件是制作状态和接入说明，不是交给视频生成软件的纯提示词。状态以本地文件检查为准；用户提供的云端时长与编码在未本地解码前仅作来源记录。

## 正式片与在制片

正式绑定只看 `GameStarter/web-demo/public/cinematics.json` 和 `public/video/media-manifest.json`。目前四段：opening-legacy-fallback、SC03-awaken-guard-20261016、EN01-seven-days-20261016、ending-legacy-fallback。execution/sacrifice 数组为空。四片源文件与构建文件哈希通过；不会自动把 review 片加入正式游戏。

| 片段 | 本地位置（项目根相对） | 状态/Library ID |
| --- | --- | --- |
| SC01旧v01 | video/in-progress/edits/SC01-lamps-weiyan-complete-review.mp4 | 本地在制，清单38.208333s；不是最新v03 |
| SC01最新v03 | video/review/20261018_v03/SC01-entry-sync-compatible-v03.mp4 | 已下载待审，未接入；13945700字节，SHA-256 `dfd35c2d9aa5cf943d73a35d8235c4982a645ba74a4d2b9ac16fe425e66f9753`；34.708333s，H264 Constrained Baseline/yuv420p、AAC48k；全片解码通过，详见本轮复核记录 |
| PR01无字幕v02 | video/in-progress/edits/PR01-prologue-27s-clean-v02.mp4 | 27s，libfile_0e46a0f3f2648191ae148214219eba90；本地哈希与清单一致，大小应为6083158字节 |
| LI01旧救人 | video/in-progress/edits/LI01-grain-road-rescue-review.mp4 | 24.625s，libfile_85f2d75a36448191b6c822fbb8104fe3；旧路边跌倒版不符合悬崖救人要求，新片待生成 |
| LI02探望合并 | video/in-progress/edits/LI02A-LI02B-visit-complete-review.mp4 | 28.833333s，libfile_26ed268ebec481919ae8a4c754b9674c；声音与尾部停顿待修 |
| EN04新版姜维 | video/in-progress/edits/EN04-jiangwei-response-review.mp4 | 19.333333s，libfile_4b1f6fd7595c8191a0c348bcb60a2477；保持新版角色，待人工审片与接入 |
| EN03+EN04 | video/in-progress/edits/EN03-EN04-ending-complete-review.mp4 | 31.958333s，libfile_5452ebc96c348191b452cf2c19cfe54e；设计接EN01后，不能单独替代EN01 |

六段在制片与原manifest的SHA-256全部一致。旧SC01 prefix在 `video/pending/`，不当作新版v03；v03独立保存在video/review/20261018_v03/。原始视频在 `video/in-progress/raw/`；当前角色/场景绑定见 `GameStarter/web-demo/visual-assets.json`，原美术在 `source-art/visuals/`；在制角色/场景参考位于 `video/in-progress/references/`，其中含诸葛亮披发肖像、持剑、魏延肖像、帐内57灯、帐外与苟安参考。泛名ref-img文件保留，未凭文件名擅自认定角色。

## 新序章补拍包（历史方案，已被新包替代；视频未生成）

2026-10-18 14:46用户要求重设计多场景短蒙太奇，原A7/B10包不再是当前已定可生成版，下述秒数仅保留历史方案依据；此为当时历史状态；当前S5新版包已下载校验。既定顺序及原许愿音画保留。权威进度见 `docs/video/RETAKE-QUEUE.md`。

来自[补拍文档](https://my.feishu.cn/docx/V7q6du8Lzo1uqCxqdw2cOTQcnPc)及[原图原音提示词包](https://my.feishu.cn/file/MwCpbbWOUoSMuMx8sF2cvPN5nGd)。浏览器下载曾中断回报，恢复后已检查Downloads实际ZIP，大小10179645字节，SHA-256 `80bf6b4d4ffbb82fd3fb405e0415cdc601b959875f8981f08bded596c184ecac`。

归档目录：`video/in-progress/prologue-supplement-20261018/`，保留 `delivery.zip` 与解包原件及哈希清单。参考图7张、原音1条、说明/提示词5份；包内没有MP4。纯提示词文件为 `A-生成提示词.txt`、`B-生成提示词.txt`，原样保留，不注入游戏条件。

| 参考图 | 用途 |
| --- | --- |
| 01-古代灭灯接点 | 实际古代片帧，灯已灭 |
| 02-手机揭示灭灯 | 同一画面回到现代手机屏幕 |
| 03-原片工位接点 | 原片桌面、手机位置、最终构图 |
| 04-暂停后放下手机 | A尾/B首共同状态 |
| 05-五年代码键盘特写 | 代码工作的局部 |
| 06-同学AI消息 | 屏内虚构群消息 |
| 07-错过行情屏幕特写 | NVDA/BTC屏幕局部 |

A7s：古代退回手机、暂停、叹气、放下；B10s：代码、同学AI、行情、失落。均待生成。计划SC01v03 0—30.625s→A7s→B10s→PR01 8.875—15.625s拿手机→PR01 21.958333—27s许愿，约59.42s。跳过PR01 15.625—21.958333s重复古代镜头。保留原许愿“要是……能时光倒流就好了”的原画原声，不重录、不改写、不增加主角脸、不让灯复燃。原片仅明确亮屏，未确认点击播放，不假称已有。

`audio/hero-opening-original.wav`来自原PR01 2.2—9.05s，6.85s，48kHz/16bit/立体声。新B约0.4—7.25s铺原声“写了五年代码，同学赶上了AI。英伟达，比特币……又错过了。”不拉伸；原音带环境声，不能与新底噪直接相加；最终需主观试听与衔接检查。

## 云端文档索引（除补拍包外本轮未逐篇下载核验）

| 类别 | 文档 |
| --- | --- |
| 五丈原 | https://my.feishu.cn/docx/Fg7yd7ODhoC0eDxSk9tcBvgbnKg |
| 李严 | https://my.feishu.cn/docx/H2kEd3hWeoRkfNxMMU8cgZCwnOd |
| 街亭 | https://my.feishu.cn/docx/Bto9dXPuJoeDiTxbSrIci7donUf |
| 夷陵 | https://my.feishu.cn/docx/LFdddmNgWodFElx5385cqyEbnif |
| 定军山候选 | https://my.feishu.cn/docx/FXXydgZUWoWGZfxePo2ctdyjnug |
| 庞统 | https://my.feishu.cn/docx/GZo9dPsmwoWzE3xMqtMcmmKnnTb |
| SC01A | https://my.feishu.cn/docx/NAbIdwgIPooyPAxcbS8cWDG1n1e |
| SC01B | https://my.feishu.cn/docx/XxpcdxaSio1ccExUHdAcP5Pdnyc |
| SC02 | https://my.feishu.cn/docx/SBtYdKJuCo38MYxcDjhcs9dunde |
| SC03 | https://my.feishu.cn/docx/NEP1dBh7sosdYfxSnlecwzx9nBg |
| EN01 | https://my.feishu.cn/docx/Qi0fdZksVoRVrHxLNsBchYWInVe |
| EN02B旧参考（当前按独立A/B生成） | https://my.feishu.cn/docx/Vap5dc8Q8oLXX7xy9aBcXVImnQh |
| EN03 | https://my.feishu.cn/docx/TcHXdpgFRoPogQxGvDDcm1F9nec |
| EN04 | https://my.feishu.cn/docx/Y8NXdnKgJo1eh1xVklvch1HRnab |
| 环境 | https://my.feishu.cn/docx/CxS8dff9MoTN5RxeY4mc9q2TnZw |
| 角色 | https://my.feishu.cn/docx/WdchduMrnopZr8x1xRxcdjjhnbh |
| 旧PR01（不是完整最新序章） | https://my.feishu.cn/docx/CYUhdzmuGoKiZBxBRCucBTu4n1G |
| LI01旧悬崖参考（当前按LI01R生成） | https://my.feishu.cn/docx/V0xmdezFgojSJhxZrAXcTsKjnbb |
| LI02A | https://my.feishu.cn/docx/RkypdBsnXomUgIxhZQhcrqaVnN9 |
| LI02B | https://my.feishu.cn/docx/RuZ1dNIYEoMbsJxzw3Tc3OJYn6O |

本轮不恢复EN02A、不生成付费视频/声纹、不新建凭据、不改变正式播放绑定。媒体采用现有LFS配置，补拍ZIP额外作为本地原包保存，不推送。发布前选择原包还是解包素材进入版本管理，避免重复大文件。

## 统一成稿审阅入口

最新独立生成链接及依赖统一见 [权威台账分片索引](video/RETAKE-QUEUE.md#当前待生成分片索引s4)：EN02B-A 22秒、EN02B-B 7秒（须用A实际末帧作首图）、LI01R 17秒；PR01新A5秒/B7.5秒独立链接已齐，当前五条包已在S5下载校验；视频尚未生成。LI01云端建议保留0—10.25秒、替换10.25—24.625秒，合成预计27.25秒，原心声约10.03秒结束，最终仍待本地听检。视频/图文分工见 [需求记录](REQUIREMENTS-20261018.md)。

统一入口为 [video/review-ready](../video/review-ready/README.md)：主目录5片保留原编号，姜维仅采用05A组合版；第二章LI02A独立保存为可用成稿，无需重拍；LI01只替换救人段、LI02B仅声修剪尾，两片位于待修分区，保留部分不受牵连。PR01仅旧现代片段。重拍及修复状态唯一维护于 [RETAKE-QUEUE](video/RETAKE-QUEUE.md)，用户按ID及时间码填写 [反馈记录](../video/review-ready/反馈记录.md)。05B重复审阅副本已移出并可恢复，源视频与正式绑定保留。逐片哈希见[审阅映射](migration/REVIEW-READY-ASSETS-20261018.json)。

## 当前五条生成包已归档（S5）

2026-10-18用户15:00已收齐五条链接。ZIP已正常下载并按32,916,105字节及交付SHA-256校验，38项安全解压，包内37项hash通过。此前“待链接/待下载”为历史阶段，当前以 [制作包入口](../video/in-progress/generation-current-20261018/README.md) 与权威台账为准。五条均待生成，EN02B-B须等A实际末帧；LI02A保留，LI02B仅声修剪尾且API配置尚未完成。
