# G3｜用户实审后画面返修交付

本轮依据2026-10-25用户实审的全片纠正执行，优先于此前制作可用结论。V21已切换到独立“无字卡返修V1”；其余四条经本轮完整静音播放及全范围画面扫查后保留原SHA，不重导。五条均记录reviewPolicy=20261025-no-meta-no-cards-no-boxes，仍为制作候选，userApproved=false，待用户审核。

当前声音未获通过：本组没有点名声音替换意见，也没有新增TTS授权；本轮零新增TTS，V21完整既有音频PCM逐样本保留。旧NPC临时原声、元说明误读/BGM风险、音色、混音和精确声口仍单独登记，未完成逐字听审。画面政策标记不代表音频通过。

| 当前逻辑段 | 成片 | 时长 | 本轮处理 |
|---|---|---:|---|
| V21 拆穿、第二封信与合谋供述 | [播放MP4](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/assembled/user-review-20261025/V21-拆穿、第二封信与合谋供述_无字卡返修V1.mp4>) | 85.875秒 | 撤摘要卡/纸面失焦，折信真实交接及干净原片近景 |
| V22 邀请访村与正式出营批准 | [播放MP4](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/assembled/V22-邀请访村与正式出营批准_画面修复V2.mp4>) | 48.525秒 | 新标准扫查后保留当前文件 |
| V23 获准访村的连续见闻 | [播放MP4](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/assembled/V23-获准访村的连续见闻_画面修复V2.mp4>) | 17.417秒 | 新标准扫查后保留当前文件 |
| V24 夜访回忆 | [播放MP4](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/assembled/V24-夜访回忆_画面修复V2.mp4>) | 73.458秒 | 新标准扫查后保留当前文件 |
| V25 赴魏散谣的未实行计划与风险 | [播放MP4](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/assembled/V25-赴魏散谣的未实行计划与风险_画面修复V2.mp4>) | 75.152秒 | 新标准扫查后保留当前文件 |

V21新版独立视频轨解码为2061帧、CFR24、85.875秒，逐帧PTS步长一致，无检出的完整黑场；已完成0至终点静音播放及关键动作、切点和时间序列检查。原片、旧摘要卡版、模糊层版和用户评论均保留为历史，不再作为当前修复依据。

[逐条旧SHA/区间到修复、新SHA及证据](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/user-review-repair.json>) · [五条画面可用性与本轮政策证据](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/review/picture-usability.json>) · [V21视频轨与音频样本保留检查](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/user-review-20261025/V21-track-coverage.json>) · [当前机器交付索引](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/delivery.json>)

## 保留的剧情与接入条件

- V21：玩家问句及心声从画外发出，保留当前自然听者窗口，不恢复旧持续代说。
- V21：第二封折信只交接一次；不恢复摘要卡、文字正文或纸面局部模糊层。
- V21：完成一次真实接信后仍须由既有信息层呈现CH2-LY07-006全文并按原设计确认读完，不能把动画播完直接当成已读或授予线索。
- V22：令牌只承担接待及材料核对，正式出营批准仍在最后粮队管事节点，不能提前据令牌放行。
- V22：两个玩家问句从画外发出，保留当前6秒/2.6秒窗口和自然听者画面。
- V24：仅作苟安口述回忆的借位视角，不能当作玩家亲见或已经独立核实的历史。
- V24：03与06由苟安画外叙述；李严仅在自己的02/04/05发言。保留当前夜帐引入、进入回忆和回到伤帐的首尾。
- V24：只采用R3原片[3.5,9.5)及记录中的精确裁框，不能把其余新纸/旁观者/说话部分接回。
- V25：按本版7秒、8.5秒的两个问句窗口接入，玩家问句只从画外发出；保留当前表情/观察镜组合，不回切旧V25-06/07连续口型或循环补时长。
- V25：V25仍是未实行计划与风险讨论；不能按影片结束自动认为已经赴魏、散谣或召军。

[第二封信准确事实及既有信息层来源映射](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/user-review-20261025/second-letter-information-mapping.json>)

## 本轮唯一新生成请求

V21-03-UR1：8秒，一次补拍完成。实际API只提交镜头指令和空发声白名单；闭合折信素白外背朝镜头，保留接住、松手、收近，不展开、不新增对白或朗读，不生成BGM。原声未用于替换本轮保留的完整既有音轨。

[独立生成审核正文](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/prompts/V21-03-UR1.md>) · [实际模型指令](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/prompts/V21-03-UR1.api.txt>) · [独立发声白名单](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/user-review-20261025/V21-03-UR1-dialogue-whitelist.json>)

## 版本与验证边界

本轮不修改游戏、线上剧本、用户原评论或浏览器通过标记。第二封信事实留原稳定编号及已设计信息层映射，不能因删除烧入影片的摘要卡而删去事实，也不能将接信动画播完直接视为已读全文。V24仍为苟安口述回忆；V25仍为尚未实施的计划。

原34条子片及历史修订继续保存在逐句计划和任务记录中，历史全文Prompt不作为本轮新请求模板。[逐句与请求计划](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/plan.json>) · [返修前交付文档](<C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH02-films-20261025/groups/G3/user-review-20261025/本组交付-返修前.md>)
