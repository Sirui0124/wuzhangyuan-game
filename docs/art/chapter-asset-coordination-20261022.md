# 第一、二章美术补缺交接 · 2026-10-22

核对方：美术资产整合审核聊天 `01a161c0-72d8-7b60-b8b0-54a943397bc9`。供补缺聊天 `01a161e1-fded-7e33-bc61-ac508f481e53` 从共享工作区读取。

本记录核对本地实际文件与当前绑定，不代表已重新读取飞书第一、二章正文。剧情资产需求由补缺方按其本轮在线正文核对。在线内容版本、生成结果、游戏接入和用户审核状态必须分别记录。

## 结论与分工

- 本美术整合聊天及其子代理目前没有在执行的图像生成任务；本轮只核对交接，不重复生成第二章资产。其他聊天或外部平台是否仍在生成，不能由文件清单推断。
- 已选用的11张新人物图、3张新场景图均已进入 `GameStarter/web-demo/visual-assets.json`，没有本聊天已选用却漏入绑定的成稿。加上原透明斥候，共12张不同的现用人物图片。
- 当前图片绑定中没有李严、苟安，也没有粮仓、蜀道运粮静态交互背景；已有第二章视频、视频身份图和场景参考。应先复用身份与空间依据，再制作缺少的透明立绘／干净交互背景，不能把已有参考当成不存在。
- 补缺方按在线正文在独立目录交付；本方保留资产审核和后续接入职责。建议使用 `source-art/visuals/incoming/chapter-02-20261022/` 或补缺方已建立的专用目录，交付后给出确切路径，不直接覆盖 runtime。
- 所有本轮新美术仍为**待用户review**。UI用户明确要求先审整页，厚木板按钮已撤下，不开展该方向的组件扩产。

## 已完成，避免重复生成

所有路径相对工作区根目录。

| 项目 | 现存目录／文件 | 状态与注意事项 |
| --- | --- | --- |
| 魏延3表情 | `source-art/visuals/runtime/characters/weiyan/{neutral,alert,resolved}-v3.png` | 真透明；母版以今日EN02B-A 4.90秒为身份依据；对白按行切换 |
| 姜维3表情 | `source-art/visuals/runtime/characters/jiangwei/{neutral,concerned,resolved}-v3.png` | 真透明；母版以今日EN04 6.69秒为身份依据；束发、蓝灰领 |
| 诸葛亮3表情 | `source-art/visuals/runtime/characters/zhugeliang/{neutral,weary,resolved}-v3.png` | 真透明；母版以今日EN03 8.71秒为身份依据；已绑定资源库，当前首章主要以视频出场 |
| 甲、乙 | `source-art/visuals/runtime/characters/guard/neutral-v3.png`、`relay/neutral-v3.png` | 原身份图编辑为真透明；亲兵目前复用甲，不是新的独立人物身份 |
| 斥候 | `source-art/visuals/runtime/characters/scout-transparent-v02.png` | 保留已有真透明版 |
| 中军帐前／传报处／姜维帐前 | `source-art/visuals/runtime/scenes/camp-v3/{camp_gate,report_post,jiangwei_tent_front}.png` | 三张不同环境均已绑定；传报处为开放小棚，姜维帐是独立较小闭帘帐 |
| 军营空间 | `source-art/visuals/spatial/camp-v1/` | 总平面、主帐内部、人物位置、机位、OBJ/MTL与离线预览；为设计样机，非历史实测或精模 |

`runtime-map.json` 为权威绑定的镜像，不另起一份互相冲突的清单。旧角色单文件与旧场景保留为历史／视频身份引用，不因新图接入而删除。

## 第二章现有依据

| 需要补的资产 | 已有材料 | 应如何使用 |
| --- | --- | --- |
| 李严独立透明立绘 | 当前图片绑定与本轮已盘点角色目录中未见李严成稿 | 先由在线正文确认形象约束；不得把苟安或其他人物改名成李严 |
| 苟安透明立绘／表情 | `video/production/CURRENT-20261021/14-LI02B-入帐相认-11秒/参考图-按序上传/01-图片1-苟安身份.png`；13-LI01-B目录亦有同图 | 这是视频身份参考，不是已接入透明立绘；结合最新LI02B/LI03实际成片锁脸和衣装，区分救援着甲与伤帐脱甲 |
| 伤帐／探望背景 | 同一14-LI02B目录 `02-图片2-帐内探望苟安.png` | 已有带人物情境参考；交互背景须明确保留床位、过道、门向和光线，按用途决定是否移除画中人物 |
| 运粮／蜀道背景 | `video/production/CURRENT-20261021/12-LI01-A-蜀道运粮-11秒/参考图-按序上传/01-图片1-蜀道泥石便道.png` | 已生成视频场景参考；保持左侧岩壁／车、右侧崖缘、泥石便道；不是全新场景设定 |
| 运粮主观手部 | 同一12-LI01-A目录 `02-图片2-第一人称扶车.png` | 带主角手部／粮车的镜头参考，不应直接充当所有交互场景的背景 |
| 救援场面 | `video/production/CURRENT-20261021/13-LI01-B-打滑与苟安救援-20秒/参考图-按序上传/03-图片3-崖下仰望抓前臂.png` | 动作与受力参考，不是空场景图或独立角色图 |
| 粮仓场景 | `video/in-progress/references/01-粮仓问讯.png`；当前LI02A粮仓视频 | 已有参考与成片，需核最新正文使用内外景、询问角色和空间，再补适合交互的清洁背景 |

上述CURRENT参考与 `video/production/CH02-Seedance-refined-v2-20261021/` 中多项为同内容副本。完整5张参考原始生成文件映射见 `video/production/CH02-Seedance-refined-v2-20261021/核验记录/图片来源.json`，不要把重复打包计算成不同设计。

本轮核对还发现补缺工作新落盘的三张参考：

| 新文件 | 实际内容与边界 |
| --- | --- |
| `docs/art/chapter-assets-20261022/references/gouan.png` | 1280×720 RGB，卧榻苟安与伤帐；不是透明立绘 |
| `docs/art/chapter-assets-20261022/references/granary.png` | 1280×720 RGB，军士、粮袋与粮仓；不是无人物交互底图 |
| `docs/art/chapter-assets-20261022/references/village.png` | 1280×720 RGB，老妇、村民与称粮场面；不是无人物村落底图 |

三图均已实际查看，均未进入图片绑定。尚未看到其明确源视频及抽帧时间记录，因此不把它们称为新生成成品或推断具体视频出处；请补缺方补齐自己的来源记录。同目录 `sources/` 的12份JSON为正文／规则／字典缓存，不是美术资产。当前未见李严独立图片，也未见已完成的第二章正式透明立绘／空场景成品。

## 视频绑定必须以实时配置为准

本次已重新读取 `GameStarter/web-demo/public/cinematics.json` 与 `public/video/media-manifest.json`：

| ID | 实际源文件 | 配置位置 |
| --- | --- | --- |
| LI01 | `video/current/LI01-cliff-rescue-20261018.mp4` | chapterPreview |
| LI02A | `video/current/LI02A-granary-20261018.mp4` | chapterPreview |
| LI02B | `video/current/LI02B-full-speed-20261022.mp4` | chapterPreview |
| LI03 | `video/current/LI03-full-speed-20261022.mp4` | chapterScenes |
| LI04 | `video/current/LI04-full-speed-20261022.mp4` | chapterScenes |

所以“LI02B未正式绑定”“新版视频均待生成”等旧报告用语不能直接沿用。`chapterScenes` 是配置存在的片段，不等同于完整第二章静态交互流程已实现。视频配置存在也不自动等于用户审片通过。本文不修改视频台账及其九列表头／用户状态。

## 已生成但有意不采用的内容

- `source-art/visuals/archive/20261022/ui-material-prototypes/`：厚木按钮、麻纸片、朱印框、深麻布片。因用户整体页面反馈撤下，禁止重新绑定为已通过资产。
- `source-art/visuals/archive/20261022/style-branches/`：E1/E2旧风格旁支，保留历史与哈希。
- 本聊天首轮传报处／姜维帐前曾生成过与主帐过于相似的候选，未选用；最终只采用 `runtime/scenes/camp-v3/` 中上述三个文件。不要从生成工具历史截图中选回被替换的候选。

## 交付审核所需最小记录

每个新增人物／场景附：资产ID、在线正文段落或行号、用途、身份／空间参考实际路径及顺序、生成Prompt、版本、输出文件、透明与尺寸结果、替代关系、已知差异。人物默认真alpha，主角色支持2—3个可辨但克制的表情；场景先对空间和人物站位。状态写待review，审核后再由本方更新绑定与图册。

本轮现有图册：`source-art/visuals/review/20261022/index.html`。完整美术整合与验证记录：`docs/art/ART-REVIEW-20261022.md`。不在收到新文件前预先写“新第二章资产已审核／已接入”。
