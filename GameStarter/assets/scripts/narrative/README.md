# 统一叙事运行核心

本目录实现 `content/schema/narrative.ts` 的唯一契约，没有第二套剧情格式。代码不依赖 Cocos API，Creator 3.8.8 UI 可以调用；当前主场景尚未挂载此核心。

## 文件与调用顺序

- `state.ts`：本轮状态、跨轮记忆、事件记录、同版本存档验证。
- `conditions.ts`：all / any / not / flag / evidence / intent 的唯一求值器。
- `engine.ts`：场景与人物选择、话题优先级、逐条确认、选择与行动、承诺预算、固定事件、回溯。
- `judge.ts`：现有 GameApi 的适配器、有限返回校验、显式预设备用接口。
- `weiyan-first.ts`：第一次交涉的完整判断 prompt 与 AI 调用入口。
- `weiyan-second.ts`：第二次交涉的完整判断 prompt 与 AI 调用入口。
- `weiyan-api.ts`：共用传输、返回格式校验与三种结果映射，不判断玩家语义。
- `weiyan.ts`：按轮次分派、固定回应映射与措辞生成。

初始化传入章节 JSON、manifest.contentVersion 和判定器：

```ts
const engine = new NarrativeEngine(chapter, manifest.contentVersion, new ApiJudge(new GameApi()));
engine.enterScene(sceneId);
engine.selectCharacter(characterId);
// 出示时：engine.presentEvidence(evidenceIds, intentId);
engine.openTopic(topicId, 'topic'); // 举证触发改为 present_evidence
const view = engine.interactions();
```

每次操作后重新读取 interactions，UI 不维护解锁 flag。场景、人物和选项均有 enabled 与原配置的不可用提示；话题按 trigger + topicId 分组，最高 priority 匹配，冲突会报内容错误。选择目标必须先到场景并选择人物。

台词展示使用 currentLine。玩家确认该条后调用 confirmLine(lineId)，才提交该条效果。播放媒体不能直接写状态。skipCurrentSegment 只确认当前已选择片段，不自动选分支、不执行承诺。片段无剩余台词时调用 completeSegment：线性节点提交 onComplete；分支节点等待选择/输入；回应片段提交相应 Outcome.effects，然后进入 next。

```ts
await engine.submitFreeInput(intentId, selectedEvidenceIds, text);
// 返回 judged / stale / technical_error；技术异常保留草稿、世界不变。
// judged 后先播放固定回应；逐条确认，再 completeSegment。
engine.choose(choiceId, interactionId);
```

同一次 UI 点击及其重试共用一个非空 interactionId，新操作用新 ID。重复 token 不重复执行。带 actionId 的选择先执行 Action，再播放选择回应；两处不要重复配置相同效果。UI 对正式剧情优先使用 choose；executeAction(actionId, interactionId) 是无对话时的显式行动入口，供行动按钮或测试调用。行动前提仍受 availableWhen 校验；当前契约没有独立 action.sceneId，因此场景中的行动应挂在对应节点选择中。

回应中的 Line.effects 逐条到达后提交，Outcome.effects 在回应完成后提交。许可可以配置在姜维的确认台词上。接受说服仅开始承诺，不执行 requiredActionIds。

## 判定、时间与回溯

普通 NPC 的 ApiJudge 将本轮已出示证据、当前人物认知与近六条相关事件、当前缺项交给 GameApi。魏延每次只传当前原话、本次实际出示的证据；第二次另传当前许可事实，不传记忆或旧对白。每轮完整 prompt 独立维护。新局不复用 responseId。AI 不能返回可执行 effects，额外 flag 字段不被消费。

普通 NPC 接受后按 acceptanceCases 顺序取第一个匹配 Outcome，没有匹配时使用 freeInput.outcomes.accept。魏延的传报行动、证据充分性、语气和挑衅均由本轮 prompt 判断；程序直接将 AI 的三种选择映射到固定剧情，不再通过关键词、引用检查或 acceptanceCases 改判。出示道具和解锁交涉仍按既定游戏步骤进行。

none 行动不消耗等待预算；delay 行动首次写 promise_warning，达到 delayBudget 时 broken。新的 startPromise 不重置已存在实例。完成承诺同时要求本次开始后实际完成全部 requiredActionIds，以及 completedWhen。打字、阅读、AI 等待和驳回没有时间费用。普通场景导航也没有隐含费用；无关耗时行为必须明确配置为 delay 行动，不从现实秒数推断。

事件按 priority 结算，每个事件本轮至多一次。事件引导的固定演出可在死亡后进入，普通场景导航仍检查 enterWhen。已选择的回应/结果片段需完成后才能改选人物或导航，避免丢失待提交结果；可以跳过既定片段。完整 rewind 随时可用，未到达的死亡线索不会因此获得。

rewind 保留 memory、历史日志、已看媒体、visitedEver 和草稿；重置本轮证据、NPC 事实、许可、承诺、互动记录与上次判定反馈。没有旧版检查点重试。state snapshot 是副本，外部修改不能影响引擎。

## 存档和实现边界

save / load 支持同一 chapterId + contentVersion 的本机存档内容，UI 可用 localStorage 保存字符串。当前只允许完成一次交互后的稳定边界保存，未完台词和正在请求 AI 时禁止保存；尚未实现媒体播放到一半的恢复。load 验证版本、flag 值域、证据轮次、承诺及引用；不兼容版本直接报错。HTML 试玩已挂载稳定边界自动存档。

内容校验和打包使用 GameStarter/scripts 下的脚本。TypeScript 从工程外 canonical 文件导入的均为 type，编译后不产生运行时外部依赖；尚未在 Creator 内验证导入。如果 Creator 的资产分析限制工程外类型，可由同一源生成工程内类型，当前没有维护第二份契约。

已在 Node 中验证最小 fixture、API 适配协议和正式五丈原的两条路线、失败与旧授权重置。正式 chapter.json 已通过校验并打包；fixture 仅位于 tests/narrative，没有发布到 assets/resources。HTML 试玩已接入，并验证真实模型的魏延两条接受路线、缺项、权限质疑、取消与超时；详细记录见 web-demo/verification。Cocos 场景与正式视频/音频尚未验证。

取消当前自由输入请求使用 `engine.cancelFreeInput()`：立即解除等待，草稿保留，迟到的分类与措辞均不可提交。分类 API 不可用或返回无效格式时，不产生剧情结果，保留草稿供重试；措辞失败只用编剧固定句，不改变 AI 已选结果。魏延当前不保存记忆或待澄清问题，旧存档的 npcIssues 被丢弃。三种选择为帐外等候、坚持入帐、震怒处斩。
