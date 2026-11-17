# 查账调查资产交接核对 · 2026-10-22

核对截止：**2026-10-22 15:46:31 +08:00**。本次只读本地实际文件、制作记录和当前图片绑定，唯一新增文件为本文；没有生成、移动图片、运行交付脚本或接入程序，也没有联系其他聊天。

**已有 21 张补缺候选图（7 景、10 位角色共 14 张人物图）；新增查账需求的 8 个场景机位和 3 位人物已出现完整 Prompt 与交付脚本，但截止本次核对，尚未发现这 11 项的交付图片、生成结果记录或验证记录。** 不要因为缺少交付图就另起一批重复请求；先核对下面列出的同一制作入口。文件存在与修改时间只能证明制作准备，不能据此确认外部生成任务是否正在运行、排队或已失败。

## 依据与状态

- 需求依据：[INVESTIGATION-LOCATIONS-RECHECK.md](INVESTIGATION-LOCATIONS-RECHECK.md)。该文记录第二章在线文案修订 0、小说修订 1269、机制修订 5，原始返回在 `recheck/`；本次没有再次在线抓取第二章，不把本地缓存称为此刻在线最新版。
- 已交付记录：[generation.json](generation.json)、[validation.json](validation.json)、[REPORT.md](REPORT.md)、[ART-DIRECTOR-REVIEW.md](ART-DIRECTOR-REVIEW.md)。21 个 PNG 均实际存在并可读取，重新计算 SHA256 全部与 validation 一致。7 张场景均为 1672×941 RGB；人物均为 RGBA，透明验收和使用边界见已有初审，不重复宣称本次完成合成验收。
- 图片绑定：[GameStarter/web-demo/visual-assets.json](../../../GameStarter/web-demo/visual-assets.json)，版本 `wuzhang-art-v3-20261022`。其中没有 `chapter-expansion-20261022` 或 `investigation-expansion-20261022`，没有本次第二章角色或查账场景的图片绑定。**已生成、待 review、已接入必须分开。**
- 新制作准备：[investigation-prompts.json](investigation-prompts.json)（15:43:13）有 11 条明确 ID、正文依据、Prompt 和参考路径；[build_investigation_review.py](build_investigation_review.py)（15:45:26）声明交付根目录为 `source-art/visuals/investigation-expansion-20261022/`。本次仅阅读脚本，没有执行。
- 截止核对时尚不存在：上述输出目录、`docs/art/chapter-assets-20261022/investigation-generation.json`、`docs/art/chapter-assets-20261022/investigation-validation.json`。它们是后续核查完成情况的明确入口，不是当前已有证据。

下文路径均相对工作区根目录 `C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/`。旧交接 [chapter-asset-coordination-20261022.md](../chapter-asset-coordination-20261022.md) 中“未见李严／第二章成品”的句子早于 12:37—12:50 这批交付，不能当作当前缺口。

## 11 项新增需求与已存在制作入口

以下“预定文件”由当前 Prompt 的 `id` 与交付脚本的 `OUT` 合成；**均不是已存在文件，也没有当前 manifest 绑定**。这 11 项已经进入同一补充 Prompt 清单，交接时沿用 ID，避免另起同义名称重复生产。

| 需求及正文依据 | 预定文件：`source-art/visuals/investigation-expansion-20261022/` 下 | 现有参考与复用边界 |
| --- | --- | --- |
| 粮仓核账内景，LY04-W01—W03 | `scenes/warehouse-interior-v1.png` | Prompt 已指定 `source-art/visuals/chapter-expansion-20261022/scenes/granary-day-v1.png`。沿用高起粮棚结构与帐列关系，补棚内/收讫核账机位；已有外景不能冒充内景已完成。 |
| 督运交接处，LY04-T01—T03 | `scenes/transport-handoff-v1.png` | 同一粮仓日景作空间母版；车场、绳具、低案的功能区。不得直接复用仓架画面或正式收件帐来合并职责。 |
| 前线收粮核验点，LY04-F01—F03 | `scenes/frontline-receipt-v1.png` | 同一粮仓日景作材质/营地依据；Prompt 已限制为本营补给区，不新造远方战场或据点。 |
| 村内农户院落，LY06-008—009 | `scenes/farm-courtyard-v1.png` | `source-art/visuals/chapter-expansion-20261022/scenes/village-day-v1.png` 作村落母版。原村口图可用于到达，不能覆盖“再往里面走”的村户调查。 |
| 书库旧卷阅览处，小说第十四节、LY13-001 | `scenes/archive-reading-v1.png` | Prompt 为新空间设计，无参考路径。现有李严书房不是此地点，不应换名充数；无需图书管理员。 |
| 征收记录核验台，LY04-C01—C04 | `scenes/levy-records-v1.png` | 粮仓日景同营独立近机位，地方记录的核账案；Prompt 明确不是提前访村或县衙。 |
| 村中原报告核账台，LY06-013—023 | `scenes/village-records-v1.png` | 村落日景中的同一建筑群/核粮桌作独立斜机位；木牍、绳束卷件，与村中人物持物统一。 |
| 本队总对账桌，LY04-001—002、M01—M03 | `scenes/team-reconciliation-v1.png` | 粮仓日景近机位；现有粮队管事可用，不另造远方建筑。分组木牍无生成的可读数字或新增证据。 |
| 地方经手人，LY04-C01—C04 | `characters/local-levy-handler/neutral-v1.png` | 已有独立新人物 Prompt，透明底；不能把村中经手人或仓吏改名视作同一剧情人物。 |
| 督运经手人，LY04-T01—T03 | `characters/transport-handler/neutral-v1.png` | 已有独立新人物 Prompt，透明底；区别于老运粮人和粮队管事。 |
| 前线接收人，LY04-F01—F03 | `characters/frontline-receiver/neutral-v1.png` | 已有独立新人物 Prompt，透明底；区别于正式收件军吏和仓边兵卒。 |

## 已存在，可复用而不必重造的图

以下均为**已生成但未绑定、仍待用户 review 的候选**，不是用户已通过的成品。7 景、14 人物图可在 [21 张图册](../../../source-art/visuals/chapter-expansion-20261022/index.html) 查看；这里只列与调查路线或易混淆地点有关的具体文件。

| 类别 | 精确已存在路径 | 可复用范围／限制 |
| --- | --- | --- |
| 粮仓日间外景 | `source-art/visuals/chapter-expansion-20261022/scenes/granary-day-v1.png` | 仓边问讯、到达镜头，及本次粮仓/交接/核账机位的空间母版。初审指出袋堆仍较多，不能称“明显空仓”；不擅自把粮紧改成完全无粮。 |
| 粮仓夜间外景 | `source-art/visuals/chapter-expansion-20261022/scenes/granary-night-v1.png` | 第三夜交接，与日景成对保持棚柱、台阶、车与帐列；局部新增案灯，不是所有道具完全不变。 |
| 村口核粮处 | `source-art/visuals/chapter-expansion-20261022/scenes/village-day-v1.png` | 村口老妇段落、村内院落与核账桌的母版；前景桌需要人物遮挡，不能一张村口代替全部村内走访。 |
| 正式收件帐候选 | `source-art/visuals/chapter-expansion-20261022/scenes/records-tent-day-v1.png` | LY09/10/12 正式收件。初审要求高桌和靠背椅改低案/矮凳后再考虑接入；不复用为督运或前线收粮点。 |
| 伤帐候选 | `source-art/visuals/chapter-expansion-20261022/scenes/infirmary-day-v1.png` | 查账前后与苟安交谈。床、过道、挂甲保留；俯身人物与床沿须实摆遮挡，病服不当着甲救援。 |
| 李严书房日／夜候选 | `source-art/visuals/chapter-expansion-20261022/scenes/liyan-study-day-v1.png`；`source-art/visuals/chapter-expansion-20261022/scenes/liyan-study-night-v1.png` | 回忆和切镜用的新空间提案，未与 LI05/LI06 核验；不是主人公亲临查账路线，也不是退军后书库。 |
| 粮队管事 | `source-art/visuals/chapter-expansion-20261022/characters/grain-officer/neutral-v1.png` | 本队材料、总对账、第三夜交接候选；不因持卷就新增已核验事实。 |
| 仓吏 | `source-art/visuals/chapter-expansion-20261022/characters/warehouse-clerk/neutral-v1.png` | 仓中收讫核验；保留蓝灰袍与木牍，不并入正式收件军吏。 |
| 老运粮人 | `source-art/visuals/chapter-expansion-20261022/characters/old-transporter/neutral-v1.png` | 村内带路/问讯；无推车接触，不当动作帧。 |
| 村户 | `source-art/visuals/chapter-expansion-20261022/characters/villager/neutral-v1.png` | 村内口粮、种粮走访；女性选角只是美术提案，不新增性别剧情。 |
| 村中经手人 | `source-art/visuals/chapter-expansion-20261022/characters/village-handler/neutral-v1.png` | LY06 核原报告。初审要求将侧边穿线硬边册修为木牍/绳束卷件，锁原脸、衣、手位；不是 LY04 地方经手人。 |
| 老妇 | `source-art/visuals/chapter-expansion-20261022/characters/old-woman/neutral-v1.png` | 村口段落；右下边缘/底部裁切待局部检查。 |
| 仓边兵卒 | `source-art/visuals/chapter-expansion-20261022/characters/granary-soldier/neutral-v1.png` | 粮仓问讯；参考静帧偏侧脸，正脸一致性仍待审，不等于前线接收人。 |
| 收件军吏 | `source-art/visuals/chapter-expansion-20261022/characters/military-clerk/neutral-v1.png` | 正式案卷收件/宣读的演员资源，是否同一剧情人保留正文；不并入前线收粮职责。 |

同包另有苟安 `characters/gouan/{guarded,conflicted,resolved}-v1.png` 和李严 `characters/liyan/{neutral,troubled,resolved}-v1.png` 共 6 张，均实际存在。苟安仅为伤后病服俯身图，李严为新身份提案；本次三个缺失职责不能通过改名这些主角色解决。

## 参考图、抽帧与成品的区分

- `docs/art/chapter-assets-20261022/references/granary.png` 与 `references/village.png` 均为 1280×720 RGB、带人物的场景参考；已有 REPORT 将其关联 LI02A、LI04。它们不是无人交互底图，不能计入新增 11 图完成数。本次未重看片或核抽帧时间，故不追加“逐帧一致”结论。
- `video/in-progress/references/01-粮仓问讯.png` 是已有粮仓视频参考。视频当前文件 `video/current/LI02A-granary-20261018.mp4`、`video/current/LI04-full-speed-20261022.mp4` 是连续性依据，不是独立场景 PNG。
- `video/production/CURRENT-20261021/12-LI01-A-蜀道运粮-11秒/参考图-按序上传/01-图片1-蜀道泥石便道.png` 已存在，可为获准返程后的粮路镜头提供空间依据；同目录 `02-图片2-第一人称扶车.png` 含手/车，不能冒充空场景。保持左山右谷，不强加路途关卡。
- `video/production/*/sources/library-*.json` 等文件中的 `library` 是既有素材库交接命名，不是书库阅卷场景资产，不能据此说书库已经生成。

## 空间、风格和接入约束

1. LY04 的征收、入仓、调拨、前线、总对账为可选择调查入口，不是必须固定顺序完成的五道题。可在同营建立不同功能机位，但图片不自行创造跨地区旅行、距离、权限或关卡。
2. LY05 授权前不安排主角访村。LY06-021 的仓吏核验回覆不意味着新增一次主角返仓旅行。李严书房保持回忆/切镜归属，退军后的书库独立。
3. 新粮仓相关机位沿用现有棚柱/台阶/帐列/泥路/远山，村内沿用同村土墙、竹篱、屋顶和自然天光。无人物环境与透明人物分开交付，机位先保留人物区域、桌沿遮挡和站位，不用重造主帐替代不同职能场景。
4. 当前 Prompt 方向为弱 CG、更多实拍质感，旧木、粗麻、自然肤色、低饱和土色；低案与无靠背矮凳/席统一器物语言。纸/木牍上不生成关键可读文字或数字，证据由剧情/UI 层呈现。
5. 三个缺失人物先保留独立角色 ID。是否复用群众演员外观是后续美术决定，视觉复用不自动合并角色；不要把新身份改写成现有军吏、村中经手人或管事。
6. 本次未建立第二章精确平面、三维连贯性模型或最终人物锚点；现有 `source-art/visuals/spatial/camp-v1/` 是第一章军营设计样机。不能把“同营功能区”的合理设计方向写成第二章空间和实际合成已验收。

后续交付落盘后，以 `investigation-generation.json` 的真实输出路径和 `investigation-validation.json` 为准重新回读，核身份/空间/alpha，再提交用户 review；不要提前把这 11 条 Prompt、已有参考帧或此核对文档标成完成生成、审批通过或正式绑定。
