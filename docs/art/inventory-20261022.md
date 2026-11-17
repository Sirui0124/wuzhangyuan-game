# 美术资产审计 · 20261022

生成时间：2026-10-22T12:31:48.085604+08:00。本报告为可重复的技术盘点，不替代视觉审核或用户通过结论。

运行：`python tools/art/asset_inventory.py`。仅写报告，不改图片、配置或 .meta。

## 范围与结果

- 图片与 SVG：982 个；总计 650.0 MiB。
- 缺失运行时绑定：0；无法读取的图片：0；完全相同 SHA-256 组：76。
- 主游戏 UI 静态交互定义：83 处（循环实例只列定义；不是屏幕上按钮数量）。
- 构建与缓存、依赖、输出目录未纳入；视频原件不作图片计数，视频参考图与审片帧保留。

| 类别 | 图片数 |
| --- | ---: |
| archive/history | 6 |
| candidate/style | 9 |
| documentation/art-review | 28 |
| documentation/video-review | 26 |
| non-art/operational | 1 |
| reference/style-research | 5 |
| reference/user | 1 |
| runtime-public/scenes | 2 |
| runtime-public/ui | 6 |
| runtime-source/characters | 17 |
| runtime-source/cinematics | 2 |
| runtime-source/scenes | 7 |
| runtime-source/ui | 15 |
| spatial/reference-and-model | 23 |
| video/reference-and-review | 834 |

## 角色透明度与实际绑定

| 原件 | 尺寸 | 真透明像素 | 半透明像素 | 当前绑定 |
| --- | --- | ---: | ---: | --- |
| `source-art/visuals/runtime/characters/guard.png` | 1086 × 1448 | 0.00% | 0.00% | 未绑定 |
| `source-art/visuals/runtime/characters/jiangwei.png` | 1086 × 1448 | 0.00% | 0.00% | 未绑定 |
| `source-art/visuals/runtime/characters/relay.png` | 1086 × 1448 | 0.00% | 0.00% | 未绑定 |
| `source-art/visuals/runtime/characters/scout-transparent-v02.png` | 1086 × 1448 | 49.63% | 50.33% | characters/scout |
| `source-art/visuals/runtime/characters/weiyan.png` | 1086 × 1448 | 0.00% | 0.00% | 未绑定 |
| `source-art/visuals/runtime/characters/zhugeliang.png` | 1086 × 1448 | 0.00% | 0.00% | 未绑定 |
| `source-art/visuals/runtime/characters/guard/neutral-v3.png` | 1024 × 1536 | 40.05% | 59.95% | characters/guard, characters/jiangwei_guard |
| `source-art/visuals/runtime/characters/jiangwei/concerned-v3.png` | 1024 × 1536 | 44.06% | 55.94% | characters/jiangwei_concerned |
| `source-art/visuals/runtime/characters/jiangwei/neutral-v3.png` | 1024 × 1536 | 44.05% | 55.95% | characters/jiangwei |
| `source-art/visuals/runtime/characters/jiangwei/resolved-v3.png` | 1024 × 1536 | 44.28% | 55.72% | characters/jiangwei_resolved |
| `source-art/visuals/runtime/characters/relay/neutral-v3.png` | 1024 × 1536 | 43.78% | 56.22% | characters/relay |
| `source-art/visuals/runtime/characters/weiyan/alert-v3.png` | 1024 × 1536 | 37.09% | 62.91% | characters/weiyan_alert |
| `source-art/visuals/runtime/characters/weiyan/neutral-v3.png` | 1024 × 1536 | 37.08% | 62.92% | characters/weiyan |
| `source-art/visuals/runtime/characters/weiyan/resolved-v3.png` | 1024 × 1536 | 37.21% | 62.79% | characters/weiyan_resolved |
| `source-art/visuals/runtime/characters/zhugeliang/neutral-v3.png` | 1024 × 1536 | 41.99% | 58.01% | characters/zhugeliang |
| `source-art/visuals/runtime/characters/zhugeliang/resolved-v3.png` | 1024 × 1536 | 42.01% | 57.99% | characters/zhugeliang_resolved |
| `source-art/visuals/runtime/characters/zhugeliang/weary-v3.png` | 1024 × 1536 | 42.11% | 57.89% | characters/zhugeliang_weary |

透明通道统计只证明文件具有真 alpha；发丝边缘、透明背景残留和身份/影片一致性仍须逐图目检。

## 运行时使用与复用

| 类别 / ID | 源文件 | 主游戏使用证据 |
| --- | --- | --- |
| characters/weiyan | `source-art/visuals/runtime/characters/weiyan/neutral-v3.png` | dialogue-mapper |
| characters/scout | `source-art/visuals/runtime/characters/scout-transparent-v02.png` | dialogue-mapper |
| characters/guard | `source-art/visuals/runtime/characters/guard/neutral-v3.png` | dialogue-mapper |
| characters/relay | `source-art/visuals/runtime/characters/relay/neutral-v3.png` | dialogue-mapper |
| characters/jiangwei | `source-art/visuals/runtime/characters/jiangwei/neutral-v3.png` | dialogue-mapper |
| characters/zhugeliang | `source-art/visuals/runtime/characters/zhugeliang/neutral-v3.png` | reserved-no-current-dialogue |
| characters/jiangwei_guard | `source-art/visuals/runtime/characters/guard/neutral-v3.png` | dialogue-mapper |
| characters/weiyan_alert | `source-art/visuals/runtime/characters/weiyan/alert-v3.png` | expression-adapter-active-role |
| characters/weiyan_resolved | `source-art/visuals/runtime/characters/weiyan/resolved-v3.png` | expression-adapter-active-role |
| characters/jiangwei_concerned | `source-art/visuals/runtime/characters/jiangwei/concerned-v3.png` | expression-adapter-active-role |
| characters/jiangwei_resolved | `source-art/visuals/runtime/characters/jiangwei/resolved-v3.png` | expression-adapter-active-role |
| characters/zhugeliang_weary | `source-art/visuals/runtime/characters/zhugeliang/weary-v3.png` | reserved-no-current-dialogue |
| characters/zhugeliang_resolved | `source-art/visuals/runtime/characters/zhugeliang/resolved-v3.png` | reserved-no-current-dialogue |
| scenes/camp_gate | `source-art/visuals/runtime/scenes/camp-v3/camp_gate.png` | chapter-flow |
| scenes/report_post | `source-art/visuals/runtime/scenes/camp-v3/report_post.png` | chapter-flow |
| scenes/relay_tent | `source-art/visuals/runtime/scenes/relay_tent.png` | not-in-current-flow |
| scenes/waiting_area | `source-art/visuals/runtime/scenes/waiting_area.png` | not-in-current-flow |
| scenes/notice_front | `source-art/visuals/runtime/scenes/camp-v3/camp_gate.png` | not-in-current-flow |
| scenes/jiangwei_tent_front | `source-art/visuals/runtime/scenes/camp-v3/jiangwei_tent_front.png` | chapter-flow |
| cinematics/weiyan_report_post | `source-art/visuals/runtime/cinematics/weiyan_report_post.png` | namespace-not-read-by-game-ts |
| cinematics/report_post_people | `source-art/visuals/runtime/cinematics/report_post_people.png` | namespace-not-read-by-game-ts |
| ui/scene_paper | `source-art/visuals/runtime/ui/scene-paper.svg` | namespace-not-read-by-game-ts |
| ui/scene_active | `source-art/visuals/runtime/ui/scene-active.svg` | namespace-not-read-by-game-ts |
| ui/title_ink | `source-art/visuals/runtime/ui/title-ink.svg` | namespace-not-read-by-game-ts |
| ui/evidence_tag | `source-art/visuals/runtime/ui/evidence-tag.svg` | namespace-not-read-by-game-ts |
| ui/evidence_notice | `source-art/visuals/runtime/ui/evidence-notice.svg` | namespace-not-read-by-game-ts |
| ui/evidence_report | `source-art/visuals/runtime/ui/evidence-report.svg` | namespace-not-read-by-game-ts |
| ui/evidence_testimony | `source-art/visuals/runtime/ui/evidence-testimony.svg` | namespace-not-read-by-game-ts |
| ui/evidence_pass | `source-art/visuals/runtime/ui/evidence-pass.svg` | namespace-not-read-by-game-ts |
| ui/icon_close | `source-art/visuals/runtime/ui/icons/close.svg` | primary-css-url |
| ui/icon_arrow | `source-art/visuals/runtime/ui/icons/arrow.svg` | namespace-not-read-by-game-ts |
| ui/icon_check | `source-art/visuals/runtime/ui/icons/check.svg` | namespace-not-read-by-game-ts |
| ui/icon_grip | `source-art/visuals/runtime/ui/icons/grip.svg` | namespace-not-read-by-game-ts |
| ui/icon_hotspot | `source-art/visuals/runtime/ui/icons/hotspot.svg` | namespace-not-read-by-game-ts |
| ui/rule_ink | `source-art/visuals/runtime/ui/icons/rule-ink.svg` | namespace-not-read-by-game-ts |

### 同一文件的多名称绑定

- characters: guard, jiangwei_guard → `runtime/characters/guard/neutral-v3.png`
- scenes: camp_gate, notice_front → `runtime/scenes/camp-v3/camp_gate.png`

## 完全相同的文件

相同 SHA 只说明内容重复；发布副本、视频上传参考包与审片证据常需保留，不自动清理。

- `b74802d3d6c3`：`GameStarter/web-demo/public/campaign-landscape-v02.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/semantic/campaign-landscape-v02.png`
- `1d7eb65b7694`：`GameStarter/web-demo/public/campaign-map.svg`；`source-art/visuals/runtime/ui/campaign-map.svg`
- `12d40d5aaa9c`：`GameStarter/web-demo/public/main-menu-background-v01.jpg`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/semantic/main-menu-background-v01.jpg`
- `ecae02a09920`：`GameStarter/web-demo/public/main-menu-button-active-v02.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/ui-retain/main-menu-button-active-v02.png`
- `b07e0236fc11`：`GameStarter/web-demo/public/main-menu-button-idle-v02.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/ui-retain/main-menu-button-idle-v02.png`
- `3200ddacf896`：`GameStarter/web-demo/public/main-menu-title-v02.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/ui-retain/main-menu-title-v02.png`
- `bc8337c52097`：`source-art/visuals/runtime/characters/guard.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/identity/guard.png`
- `5bf90cef3b32`：`source-art/visuals/runtime/characters/jiangwei.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/identity/jiangwei.png`
- `45dc9816fc60`：`source-art/visuals/runtime/characters/relay.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/identity/relay.png`
- `50b47aee1581`：`source-art/visuals/runtime/characters/scout-transparent-v02.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/identity/scout-transparent-v02.png`
- `837368c9c540`：`source-art/visuals/runtime/characters/weiyan.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/identity/weiyan.png`；`video/production/PR01-visual-remake-20261019/references/identity/I04_weiyan-game.png`
- `53e8bcd60491`：`source-art/visuals/runtime/characters/zhugeliang.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/identity/zhugeliang.png`；`video/production/PR01-visual-remake-20261019/references/identity/I01_zhugeliang-game.png`
- `d085b94dbef3`：`source-art/visuals/runtime/cinematics/report_post_people.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/semantic/report_post_people.png`
- `b620d8a44eed`：`source-art/visuals/runtime/cinematics/weiyan_report_post.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/semantic/weiyan_report_post.png`
- `524b3654f56e`：`source-art/visuals/runtime/scenes/camp_gate.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/semantic/camp_gate.png`
- `b72f6dd5ae6f`：`source-art/visuals/runtime/scenes/relay_tent.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/semantic/relay_tent.png`
- `d99660e43687`：`source-art/visuals/runtime/scenes/report_post.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/semantic/report_post.png`
- `0d4ad9f42e8e`：`source-art/visuals/runtime/scenes/waiting_area.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/semantic/waiting_area.png`
- `b45ec1f7784e`：`video/in-progress/generation-current-20261018/当前五条视频生成包/01-PR01A-手机揭示与暂停-5秒/参考图/图片1-01-古代灭灯接点.png`；`video/in-progress/prologue-supplement-20261018/references/01-古代灭灯接点.png`
- `c1a7471b7184`：`video/in-progress/generation-current-20261018/当前五条视频生成包/01-PR01A-手机揭示与暂停-5秒/参考图/图片2-02-手机揭示灭灯.png`；`video/in-progress/prologue-supplement-20261018/references/02-手机揭示灭灯.png`
- `83df89e9d0fd`：`video/in-progress/generation-current-20261018/当前五条视频生成包/01-PR01A-手机揭示与暂停-5秒/参考图/图片3-03-原片工位接点.png`；`video/in-progress/generation-current-20261018/当前五条视频生成包/02-PR01B-时代遗憾多场景回忆-7.5秒/参考图/图片5-03-原片工位接点.png`；`video/in-progress/prologue-supplement-20261018/references/03-原片工位接点.png`
- `17276016e897`：`video/in-progress/generation-current-20261018/当前五条视频生成包/03-EN02B-A-魏延问责与收矛-22秒/参考图/图片1-01-魏延身份.png`；`video/refs/01-魏延身份.png`
- `b7c05ecfe73d`：`video/in-progress/generation-current-20261018/当前五条视频生成包/03-EN02B-A-魏延问责与收矛-22秒/参考图/图片2-04-清晨问责站位.png`；`video/in-progress/generation-current-20261018/当前五条视频生成包/04-EN02B-B-押走与死亡-7秒/参考图/图片2-04-清晨问责站位.png`；`video/refs/04-清晨问责站位.png`
- `1c3646822f23`：`video/in-progress/generation-current-20261018/当前五条视频生成包/03-EN02B-A-魏延问责与收矛-22秒/参考图/图片3-03-第一人称持矛.png`；`video/in-progress/generation-current-20261018/当前五条视频生成包/04-EN02B-B-押走与死亡-7秒/参考图/图片3-03-第一人称持矛.png`；`video/refs/03-第一人称持矛.png`
- `232c4a319d8d`：`video/in-progress/generation-current-20261018/当前五条视频生成包/05-LI01R-崖边坠险救援替换段-17秒/参考图/图片1-01-蜀道运粮-山路全景.png`；`video/in-progress/references/LI01_图1_蜀道山路全景.png`；`video/production/CH02-LI01-Seedance-20261021/参考图-按序上传/01-蜀道山路全景.png`
- `fdaa1c8d7b2e`：`video/in-progress/generation-current-20261018/当前五条视频生成包/05-LI01R-崖边坠险救援替换段-17秒/参考图/图片2-02-苟安-身份参考.png`；`video/in-progress/references/LI01_图2_苟安身份参考.png`
- `fc7daea5b5b2`：`video/in-progress/generation-current-20261018/当前五条视频生成包/05-LI01R-崖边坠险救援替换段-17秒/参考图/图片4-04-LI01原片10.25秒衔接帧.png`；`video/production/CH02-LI01-Seedance-20261021/参考图-按序上传/02-救援前衔接帧.png`
- `4f0082788366`：`video/in-progress/references/图2_诸葛亮披发正面肖像.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/identity/I02_zhugeliang-video-portrait.png`；`video/production/PR01-visual-remake-20261019/references/identity/I02_zhugeliang-video-portrait.png`
- `e17fd61c895a`：`video/in-progress/references/图3_诸葛亮持剑参考.png`；`video/production/PR01-visual-remake-20261019/references/identity/I03_zhugeliang-sword.png`
- `0e1433e82c1b`：`video/in-progress/references/图4_魏延写实肖像.png`；`video/production/CH01-visual-remake-v3-20261020/sources/source-images/identity/I05_weiyan-video-portrait.png`；`video/production/PR01-visual-remake-20261019/references/identity/I05_weiyan-video-portrait.png`
- `eb320b7743aa`：`video/production/CH01-Seedance-v4-latest-20261020/01-PR01-A-夜营借寿-13s/参考图-按序上传/01-图片1-R01-night-camp.png`；`video/production/CH01-Seedance-v4-latest-20261020/02-PR01-B-军情奔马与赶赴主帐-11s/参考图-按序上传/03-图片3-R01-night-camp.png`；`video/production/CH01-Seedance-v4-latest-20261020/07-SC03-醒来确认木矛并守营-24s/参考图-按序上传/02-图片2-R01-night-camp.png`；`video/production/CH01-Seedance-v4-latest-20261020/11-EN04-姜维叹战机主角回应-20s/参考图-按序上传/02-图片2-R01-night-camp.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R01-night-camp.png`；`video/production/CURRENT-20261021/01-PR01-A-夜营借寿-13秒/参考图-按序上传/01-图片1-R01-night-camp.png`；`video/production/CURRENT-20261021/02-PR01-B-军情奔马与赴帐-11秒/参考图-按序上传/03-图片3-R01-night-camp.png`；`video/production/CURRENT-20261021/07-SC03-醒来守营-24秒/参考图-按序上传/02-图片2-R01-night-camp.png`；`video/production/CURRENT-20261021/11-EN04-姜维叹战机-20秒/参考图-按序上传/02-图片2-R01-night-camp.png`
- `2742c0874deb`：`video/production/CH01-Seedance-v4-latest-20261020/01-PR01-A-夜营借寿-13s/参考图-按序上传/02-图片2-R02-ritual-tent.png`；`video/production/CH01-Seedance-v4-latest-20261020/03-PR01-C-入门喊丞相即灭灯-7s/参考图-按序上传/01-图片1-R02-ritual-tent.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R02-ritual-tent.png`；`video/production/CURRENT-20261021/01-PR01-A-夜营借寿-13秒/参考图-按序上传/02-图片2-R02-ritual-tent.png`；`video/production/CURRENT-20261021/03-PR01-C-入门即灭灯-7秒/参考图-按序上传/01-图片1-R02-ritual-tent.png`
- `0262d6cb3eb0`：`video/production/CH01-Seedance-v4-latest-20261020/01-PR01-A-夜营借寿-13s/参考图-按序上传/03-图片3-R03-zhugeliang-sword.png`；`video/production/CH01-Seedance-v4-latest-20261020/03-PR01-C-入门喊丞相即灭灯-7s/参考图-按序上传/04-图片4-R03-zhugeliang-sword.png`；`video/production/CH01-Seedance-v4-latest-20261020/06-PR01-F-拿起手机播放与许愿-12s/参考图-按序上传/03-图片3-R03-zhugeliang-sword.png`；`video/production/CH01-Seedance-v4-latest-20261020/09-EN01-七日期满主灯未灭-20s/参考图-按序上传/02-图片2-R03-zhugeliang-sword.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R03-zhugeliang-sword.png`；`video/production/CURRENT-20261021/01-PR01-A-夜营借寿-13秒/参考图-按序上传/03-图片3-R03-zhugeliang-sword.png`；`video/production/CURRENT-20261021/03-PR01-C-入门即灭灯-7秒/参考图-按序上传/04-图片4-R03-zhugeliang-sword.png`；`video/production/CURRENT-20261021/06-PR01-F-播放与许愿-12秒/参考图-按序上传/03-图片3-R03-zhugeliang-sword.png`；`video/production/CURRENT-20261021/09-EN01-七日期满-20秒/参考图-按序上传/02-图片2-R03-zhugeliang-sword.png`
- `90ecfa960120`：`video/production/CH01-Seedance-v4-latest-20261020/01-PR01-A-夜营借寿-13s/参考图-按序上传/04-图片4-R05-lamp-extinguished.png`；`video/production/CH01-Seedance-v4-latest-20261020/03-PR01-C-入门喊丞相即灭灯-7s/参考图-按序上传/03-图片3-R05-lamp-extinguished.png`；`video/production/CH01-Seedance-v4-latest-20261020/04-PR01-D-手机揭示暂停叹气-5s/参考图-按序上传/01-图片1-R05-lamp-extinguished.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R05-lamp-extinguished.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R05-lamp-extinguished.png`；`video/production/CURRENT-20261021/01-PR01-A-夜营借寿-13秒/参考图-按序上传/04-图片4-R05-lamp-extinguished.png`；`video/production/CURRENT-20261021/03-PR01-C-入门即灭灯-7秒/参考图-按序上传/03-图片3-R05-lamp-extinguished.png`；`video/production/CURRENT-20261021/04-PR01-D-手机揭示-5秒/参考图-按序上传/01-图片1-R05-lamp-extinguished.png`
- `590432070bc8`：`video/production/CH01-Seedance-v4-latest-20261020/02-PR01-B-军情奔马与赶赴主帐-11s/参考图-按序上传/01-图片1-R11-courier-arrival.png`；`video/production/CH01-Seedance-v4-latest-20261020/03-PR01-C-入门喊丞相即灭灯-7s/参考图-按序上传/05-图片5-R11-courier-arrival.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R11-courier-arrival.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R11-courier-arrival.png`；`video/production/CURRENT-20261021/02-PR01-B-军情奔马与赴帐-11秒/参考图-按序上传/01-图片1-R11-courier-arrival.png`；`video/production/CURRENT-20261021/03-PR01-C-入门即灭灯-7秒/参考图-按序上传/05-图片5-R11-courier-arrival.png`
- `adf6b520b4c6`：`video/production/CH01-Seedance-v4-latest-20261020/02-PR01-B-军情奔马与赶赴主帐-11s/参考图-按序上传/02-图片2-R04-weiyan-escorts.png`；`video/production/CH01-Seedance-v4-latest-20261020/03-PR01-C-入门喊丞相即灭灯-7s/参考图-按序上传/02-图片2-R04-weiyan-escorts.png`；`video/production/CH01-Seedance-v4-latest-20261020/08-EN02B-A-次日军报问责与收唯一木矛-22s/参考图-按序上传/02-图片2-R04-weiyan-escorts.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R04-weiyan-escorts.png`；`video/production/CURRENT-20261021/02-PR01-B-军情奔马与赴帐-11秒/参考图-按序上传/02-图片2-R04-weiyan-escorts.png`；`video/production/CURRENT-20261021/03-PR01-C-入门即灭灯-7秒/参考图-按序上传/02-图片2-R04-weiyan-escorts.png`；`video/production/CURRENT-20261021/08-EN02B-A-次日问责与收矛-22秒/参考图-按序上传/02-图片2-R04-weiyan-escorts.png`
- `49c8106ea9c0`：`video/production/CH01-Seedance-v4-latest-20261020/04-PR01-D-手机揭示暂停叹气-5s/参考图-按序上传/02-图片2-R06-phone-reveal.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R06-phone-reveal.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R06-phone-reveal.png`；`video/production/CURRENT-20261021/04-PR01-D-手机揭示-5秒/参考图-按序上传/02-图片2-R06-phone-reveal.png`
- `17ea2ea1eaa7`：`video/production/CH01-Seedance-v4-latest-20261020/04-PR01-D-手机揭示暂停叹气-5s/参考图-按序上传/03-图片3-R09-office-space.png`；`video/production/CH01-Seedance-v4-latest-20261020/05-PR01-E-时代遗憾快蒙太奇-7s/参考图-按序上传/03-图片3-R09-office-space.png`；`video/production/CH01-Seedance-v4-latest-20261020/06-PR01-F-拿起手机播放与许愿-12s/参考图-按序上传/02-图片2-R09-office-space.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R09-office-space.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R09-office-space.png`；`video/production/CURRENT-20261021/04-PR01-D-手机揭示-5秒/参考图-按序上传/03-图片3-R09-office-space.png`；`video/production/CURRENT-20261021/05-PR01-E-时代遗憾-8秒/参考图-按序上传/03-图片3-R09-office-space.png`；`video/production/CURRENT-20261021/06-PR01-F-播放与许愿-12秒/参考图-按序上传/02-图片2-R09-office-space.png`
- `6b1cb26a41ee`：`video/production/CH01-Seedance-v4-latest-20261020/05-PR01-E-时代遗憾快蒙太奇-7s/参考图-按序上传/01-图片1-R07-commute.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R07-commute.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R07-commute.png`；`video/production/CURRENT-20261021/05-PR01-E-时代遗憾-8秒/参考图-按序上传/01-图片1-R07-commute.png`
- `f415913049fb`：`video/production/CH01-Seedance-v4-latest-20261020/05-PR01-E-时代遗憾快蒙太奇-7s/参考图-按序上传/02-图片2-R08-classmate-ai.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R08-classmate-ai.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R08-classmate-ai.png`；`video/production/CURRENT-20261021/05-PR01-E-时代遗憾-8秒/参考图-按序上传/02-图片2-R08-classmate-ai.png`
- `0404078a837c`：`video/production/CH01-Seedance-v4-latest-20261020/06-PR01-F-拿起手机播放与许愿-12s/参考图-按序上传/01-图片1-R10-phone-wish.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/opening/R10-phone-wish.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R10-phone-wish.png`；`video/production/CURRENT-20261021/06-PR01-F-播放与许愿-12秒/参考图-按序上传/01-图片1-R10-phone-wish.png`
- `284e81d39658`：`video/production/CH01-Seedance-v4-latest-20261020/07-SC03-醒来确认木矛并守营-24s/参考图-按序上传/01-图片1-V-SC03-final.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/ending/V-SC03-final.png`
- `492ceb9927d8`：`video/production/CH01-Seedance-v4-latest-20261020/08-EN02B-A-次日军报问责与收唯一木矛-22s/参考图-按序上传/01-图片1-V-EN02BA.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/ending/V-EN02BA.png`
- `ba57f20b3232`：`video/production/CH01-Seedance-v4-latest-20261020/09-EN01-七日期满主灯未灭-20s/参考图-按序上传/01-图片1-V14-dawn-lamps-lit.png`；`video/production/CH01-Seedance-v4-latest-20261020/10-EN03-战机未改半月再借寿-13s/参考图-按序上传/03-图片3-V14-dawn-lamps-lit.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/ending/V14-dawn-lamps-lit.png`；`video/production/CURRENT-20261021/09-EN01-七日期满-20秒/参考图-按序上传/01-图片1-V14-dawn-lamps-lit.png`；`video/production/CURRENT-20261021/10-EN03-半月再借寿-13秒/参考图-按序上传/03-图片3-V14-dawn-lamps-lit.png`
- `1d767dcc4531`：`video/production/CH01-Seedance-v4-latest-20261020/09-EN01-七日期满主灯未灭-20s/参考图-按序上传/03-图片3-V-EN01.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/ending/V-EN01.png`；`video/production/CURRENT-20261021/09-EN01-七日期满-20秒/参考图-按序上传/03-图片3-V-EN01.png`
- `454a9c9cec85`：`video/production/CH01-Seedance-v4-latest-20261020/10-EN03-战机未改半月再借寿-13s/参考图-按序上传/01-图片1-V-EN03a-final.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/ending/V-EN03a-final.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/ending/V-EN03a-final.png`；`video/production/CURRENT-20261021/10-EN03-半月再借寿-13秒/参考图-按序上传/01-图片1-V-EN03a-final.png`
- `b40187ba0e2c`：`video/production/CH01-Seedance-v4-latest-20261020/10-EN03-战机未改半月再借寿-13s/参考图-按序上传/02-图片2-V-EN03b.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/ending/V-EN03b.png`；`video/production/CURRENT-20261021/10-EN03-半月再借寿-13秒/参考图-按序上传/02-图片2-V-EN03b.png`
- `448c56f23491`：`video/production/CH01-Seedance-v4-latest-20261020/11-EN04-姜维叹战机主角回应-20s/参考图-按序上传/01-图片1-V-EN04.png`；`video/production/CH01-ink-liveaction-v4-20261020/ready-to-generate/references/ending/V-EN04.png`；`video/production/CURRENT-20261021/11-EN04-姜维叹战机-20秒/参考图-按序上传/01-图片1-V-EN04.png`
- `b137b260377d`：`video/production/CH01-ink-liveaction-v4-20261020/game-art/characters/P01-guard-v3.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/characters/P01-guard-v3.png`
- `d154188493ee`：`video/production/CH01-ink-liveaction-v4-20261020/game-art/characters/P02-relay-v3.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/characters/P02-relay-v3.png`
- `9b45006b4a0f`：`video/production/CH01-ink-liveaction-v4-20261020/game-art/characters/P03-scout-v3.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/characters/P03-scout-v3.png`
- `a729f8db8ada`：`video/production/CH01-ink-liveaction-v4-20261020/game-art/characters/P05-jiangwei-v3.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/characters/P05-jiangwei-v3.png`
- `004d446827f0`：`video/production/CH01-ink-liveaction-v4-20261020/game-art/environments/M01-main-menu-background-v3.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/environments/M01-main-menu-background-v3.png`
- `59137282bbfa`：`video/production/CH01-ink-liveaction-v4-20261020/game-art/environments/M02-campaign-landscape-v3.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/environments/M02-campaign-landscape-v3.png`
- `32f67305eac9`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/C01.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/composites/C01-weiyan_report_post-v3.png`
- `e3f96bfeacac`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/C02.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/composites/C02-report_post_people-v3.png`
- `144f6abd04f9`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/P04.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/characters/P04-weiyan-v3-final.png`
- `65dc9d279289`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/R01.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R01-night-camp.png`
- `b81893a5f5c1`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/R02.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R02-ritual-tent.png`
- `48e7ac5fefa7`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/R03.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R03-zhugeliang-sword.png`；`video/production/CH01-visual-remake-v3-20261020/references/approved/STYLE-v3-zhugeliang.png`；`video/production/PR01-visual-remake-20261019/style-correction-20261020/v3/PR01-诸葛亮-画风样张-v3.png`
- `063b9d2f0eec`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/R04.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/opening/R04-weiyan-escorts.png`
- `859a2a5bdd49`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/S01.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/environments/S01-camp_gate-v3-refined.png`
- `53f9a6dc8826`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/S02.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/environments/S02-report_post-v3-refined.png`
- `7808b2305d2e`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/S03.png`；`video/production/CH01-visual-remake-v3-20261020/game-art-v3/environments/S03-relay_tent-v3-refined.png`
- `f786fbf91b60`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/V-EN01.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/ending/V-EN01.png`
- `af4bdc4c0608`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/V-EN02BA.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/ending/V-EN02BA.png`
- `38b368abf625`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/V-EN03b.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/ending/V-EN03b.png`
- `16551c9e1d8c`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/V-EN04.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/ending/V-EN04.png`
- `c6b6857872ff`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/V-SC03.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/ending/V-SC03-final.png`
- `7cbf82ba9030`：`video/production/CH01-ink-liveaction-v4-20261020/review/originals/V14.png`；`video/production/CH01-visual-remake-v3-20261020/ready-to-generate/references/ending/V14-dawn-lamps-lit.png`
- `380306407682`：`video/production/CH01-visual-remake-v3-20261020/review/PR01-source-contact-sheet.jpg`；`video/production/PR01-visual-remake-20261019/review/PR01-source-contact-sheet.jpg`
- `160229f8e86c`：`video/production/CH02-Seedance-refined-v2-20261021/01-蜀道运粮-11秒/参考图-按序上传/01-图片1-蜀道泥石便道.png`；`video/production/CURRENT-20261021/12-LI01-A-蜀道运粮-11秒/参考图-按序上传/01-图片1-蜀道泥石便道.png`
- `849eabbea63d`：`video/production/CH02-Seedance-refined-v2-20261021/01-蜀道运粮-11秒/参考图-按序上传/02-图片2-第一人称扶车.png`；`video/production/CH02-Seedance-refined-v2-20261021/02-打滑遇险与苟安救援-20秒/参考图-按序上传/01-图片1-第一人称扶车.png`；`video/production/CURRENT-20261021/12-LI01-A-蜀道运粮-11秒/参考图-按序上传/02-图片2-第一人称扶车.png`；`video/production/CURRENT-20261021/13-LI01-B-打滑与苟安救援-20秒/参考图-按序上传/01-图片1-第一人称扶车.png`
- `b6a4ba2b13b7`：`video/production/CH02-Seedance-refined-v2-20261021/02-打滑遇险与苟安救援-20秒/参考图-按序上传/02-图片2-苟安身份.png`；`video/production/CH02-Seedance-refined-v2-20261021/03-入帐探望认出苟安-11秒/参考图-按序上传/01-图片1-苟安身份.png`；`video/production/CURRENT-20261021/13-LI01-B-打滑与苟安救援-20秒/参考图-按序上传/02-图片2-苟安身份.png`；`video/production/CURRENT-20261021/14-LI02B-入帐相认-11秒/参考图-按序上传/01-图片1-苟安身份.png`
- `8fe81cd35b2f`：`video/production/CH02-Seedance-refined-v2-20261021/02-打滑遇险与苟安救援-20秒/参考图-按序上传/03-图片3-崖下仰望抓前臂.png`；`video/production/CURRENT-20261021/13-LI01-B-打滑与苟安救援-20秒/参考图-按序上传/03-图片3-崖下仰望抓前臂.png`
- `41688c5d4866`：`video/production/CH02-Seedance-refined-v2-20261021/03-入帐探望认出苟安-11秒/参考图-按序上传/02-图片2-帐内探望苟安.png`；`video/production/CURRENT-20261021/14-LI02B-入帐相认-11秒/参考图-按序上传/02-图片2-帐内探望苟安.png`

## UI 组件逐项清单

来源为当前主入口 game.ts、thought-workspace-view.ts、ending-album.ts、cinematics.ts；未将 legacy 和独立 art-review 样张误报为主游戏。

| 来源 | 类型 | 行为 / 标识 |
| --- | --- | --- |
| `GameStarter/web-demo/src/game.ts:85` | button | notes |
| `GameStarter/web-demo/src/game.ts:85` | button | records |
| `GameStarter/web-demo/src/game.ts:85` | button | save |
| `GameStarter/web-demo/src/game.ts:85` | button | settings |
| `GameStarter/web-demo/src/game.ts:85` | button | menu |
| `GameStarter/web-demo/src/game.ts:88` | button | continue |
| `GameStarter/web-demo/src/game.ts:88` | button | new |
| `GameStarter/web-demo/src/game.ts:88` | button | chapters |
| `GameStarter/web-demo/src/game.ts:88` | button | album |
| `GameStarter/web-demo/src/game.ts:88` | button | settings |
| `GameStarter/web-demo/src/game.ts:96` | button | next |
| `GameStarter/web-demo/src/game.ts:96` | button | reply |
| `GameStarter/web-demo/src/game.ts:96` | button | cancel-speech |
| `GameStarter/web-demo/src/game.ts:96` | button | retry-speech |
| `GameStarter/web-demo/src/game.ts:96` | button | revise |
| `GameStarter/web-demo/src/game.ts:108` | button | close-notes |
| `GameStarter/web-demo/src/game.ts:117` | button | generate-expression |
| `GameStarter/web-demo/src/game.ts:117` | button | cancel-generation |
| `GameStarter/web-demo/src/game.ts:118` | button | transfer-focus |
| `GameStarter/web-demo/src/game.ts:124` | button | suggestion |
| `GameStarter/web-demo/src/game.ts:124` | button | read-evidence |
| `GameStarter/web-demo/src/game.ts:124` | button | speak |
| `GameStarter/web-demo/src/game.ts:130` | button | open-inventory |
| `GameStarter/web-demo/src/game.ts:134` | button | rewind |
| `GameStarter/web-demo/src/game.ts:134` | button | map |
| `GameStarter/web-demo/src/game.ts:134` | button | album |
| `GameStarter/web-demo/src/game.ts:134` | button | menu |
| `GameStarter/web-demo/src/game.ts:138` | button | menu |
| `GameStarter/web-demo/src/game.ts:138` | button | chapter-preview |
| `GameStarter/web-demo/src/game.ts:142` | button | save-api |
| `GameStarter/web-demo/src/game.ts:142` | button | test-api |
| `GameStarter/web-demo/src/game.ts:142` | button | settings |
| `GameStarter/web-demo/src/game.ts:174` | button | load-auto |
| `GameStarter/web-demo/src/game.ts:177` | button | new-confirmed |
| `GameStarter/web-demo/src/game.ts:96` | button | data-scout-choice=a |
| `GameStarter/web-demo/src/game.ts:96` | button | data-scout-choice=b |
| `GameStarter/web-demo/src/game.ts:96` | button | class=scene-hotspot, data-scene-action=${action.id} |
| `GameStarter/web-demo/src/game.ts:96` | button | data-move=${scene.id} |
| `GameStarter/web-demo/src/game.ts:96` | button | class=open-thought-callout, data-action=notes |
| `GameStarter/web-demo/src/game.ts:96` | button | class=dialogue-text ${gain ? 'has-clue' : ''}, data-action=next |
| `GameStarter/web-demo/src/game.ts:100` | button | data-read-note=${source} |
| `GameStarter/web-demo/src/game.ts:116` | textarea | id=expression-focus |
| `GameStarter/web-demo/src/game.ts:122` | textarea | id=player-expression |
| `GameStarter/web-demo/src/game.ts:130` | button | class=working-clue-title, data-read-note=${id} |
| `GameStarter/web-demo/src/game.ts:130` | button | class=working-clue-remove, data-use=${id} |
| `GameStarter/web-demo/src/game.ts:138` | button | data-action=chapter-scene-preview, data-preview-clip=${esc(clip.id)} |
| `GameStarter/web-demo/src/game.ts:142` | input | type=range, data-volume=${bus} |
| `GameStarter/web-demo/src/game.ts:142` | input | id=reduce-motion, type=checkbox |
| `GameStarter/web-demo/src/game.ts:142` | summary |  |
| `GameStarter/web-demo/src/game.ts:142` | input | id=api-base |
| `GameStarter/web-demo/src/game.ts:142` | input | id=api-model |
| `GameStarter/web-demo/src/game.ts:142` | input | id=api-key, type=password |
| `GameStarter/web-demo/src/game.ts:174` | button | data-store-slot=${slot} |
| `GameStarter/web-demo/src/game.ts:174` | button | data-load-slot=${slot} |
| `GameStarter/web-demo/src/game.ts:178` | button | class=modal-close, data-action=close-modal |
| `GameStarter/web-demo/src/thought-workspace-view.ts:11` | button | data-action=reasoning-mode |
| `GameStarter/web-demo/src/thought-workspace-view.ts:11` | button | data-action=language-mode |
| `GameStarter/web-demo/src/thought-workspace-view.ts:17` | button | class=inventory-tab, data-action=notes-list |
| `GameStarter/web-demo/src/thought-workspace-view.ts:18` | button | data-action=notes-list |
| `GameStarter/web-demo/src/thought-workspace-view.ts:20` | button | class=inventory-row, data-inventory-item=${id}, data-inventory-drag=${id} |
| `GameStarter/web-demo/src/thought-workspace-view.ts:20` | button | class=inventory-place, data-place-evidence=${id} |
| `GameStarter/web-demo/src/thought-workspace-view.ts:24` | button | class=working-clue-title, data-read-note=${id} |
| `GameStarter/web-demo/src/thought-workspace-view.ts:24` | button | class=working-clue-remove, data-remove-thought=${id} |
| `GameStarter/web-demo/src/thought-workspace-view.ts:40` | button | data-action=close-notes |
| `GameStarter/web-demo/src/thought-workspace-view.ts:40` | button | data-action=follow-plan |
| `GameStarter/web-demo/src/thought-workspace-view.ts:41` | button | class=drop-invitation, data-action=open-inventory |
| `GameStarter/web-demo/src/thought-workspace-view.ts:41` | button | class=think-button, data-action=think |
| `GameStarter/web-demo/src/thought-workspace-view.ts:42` | button | class=thought-more, data-action=open-inventory |
| `GameStarter/web-demo/src/thought-workspace-view.ts:44` | button | class=revise-thought, data-action=revise-thought |
| `GameStarter/web-demo/src/thought-workspace-view.ts:45` | button | data-action=close-notes |
| `GameStarter/web-demo/src/thought-workspace-view.ts:46` | button | class=thought-tail-link, data-action=thought-tail |
| `GameStarter/web-demo/src/ending-album.ts:51` | button | data-album-action=previous |
| `GameStarter/web-demo/src/ending-album.ts:51` | button | data-album-action=next |
| `GameStarter/web-demo/src/ending-album.ts:53` | button | class=album-card ${unlocked(e) ? 'unlocked' : 'sealed'}, data-album-action=card, data-album-id=${escape(e.id)} |
| `GameStarter/web-demo/src/ending-album.ts:53` | button | data-album-action=filter, data-album-id=all |
| `GameStarter/web-demo/src/ending-album.ts:55` | button | class=album-return, data-album-action=close |
| `GameStarter/web-demo/src/ending-album.ts:55` | button | class=album-back, data-album-action=overview |
| `GameStarter/web-demo/src/ending-album.ts:55` | button | data-album-action=filter, data-album-id=${key} |
| `GameStarter/web-demo/src/cinematics.ts:36` | button | type=button, data-cinema-action=toggle |
| `GameStarter/web-demo/src/cinematics.ts:36` | button | type=button, data-cinema-action=sound |
| `GameStarter/web-demo/src/cinematics.ts:36` | input | class=cinema-seek, type=range |
| `GameStarter/web-demo/src/cinematics.ts:36` | button | type=button, data-cinema-rate=${rate} |
| `GameStarter/web-demo/src/cinematics.ts:36` | button | type=button, data-cinema-action=skip |

## 技术边界

本次静态扫描不代替浏览器试玩、Cocos 编辑器验证、动画或对比视频审片。每个图片的哈希、alpha、引用位置详见同名 JSON；归档操作另见 source-art/visuals/archive/20261022/manifest.json。未绑定图不等于无效图。
