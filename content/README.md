# 统一剧情内容目录

当前策划维护入口见[协作原则](../docs/design/COLLABORATION-PRINCIPLES.md)，跨场景机制见[全局游戏规则](../docs/design/GLOBAL-GAME-RULES.md)。

## 当前游戏

- `schema/chapter-session.ts`：第一章场景流程契约。
- `chapters/wuzhang/chapter-one.script.json`：第一章正文。
- `chapters/wuzhang/chapter-one.flow.json`：第一章场景行动与段落转场。
- `chapters/grain/chapter-two.playable.json`：第二章开场至第二节的试玩内容。

章节实现位于 `GameStarter/web-demo/src/chapters/`。网页构建将内容复制到发布目录；编辑源文件后重新构建。

## 旧版与格式参考

旧版网页已移除。以下文件保留为底层叙事核心测试、Cocos 内容工具及创作历史，不进入当前网页剧情；旧格式说明见 `../docs/统一玩法与文本规范_v1.md`。

- `schema/narrative.ts`：旧版叙事格式契约。
- `../docs/剧本对话编写指南与示例_v1.md`：编剧节点卡、字段映射、举证反馈、行动兑现及失败回溯的写作指南。
- `examples/wuzhang-authoring.example.ts`：兼容导出入口；对话、判定、行动、承诺和事件样例按职责拆在 `examples/wuzhang/`，用于格式参考，不是独立章节。
- `examples/dialogue-format.example.ts`：普通调查、举证自由输入的格式样例，引用未完整定义，不可当作可运行章节。
- `chapters/wuzhang/chapter.json`：旧版五丈原章节，包含场景、人物、证据、对话、行动、判定和事件。
- `chapters/wuzhang/walkthrough.md`：两条核心路线及失败路线的预期状态变化。

章节内容目录为创作源文件。后续打包脚本验证通过后，将 JSON 复制到 `GameStarter/assets/resources/story/` 供 Cocos 读取；运行资源不手改，已有 `.meta` 必须保留。原始音频和美术放 `../source-art/`，视频放 `../video/`，上线资源由 UI/资源工作流导入工程。

样例修改不会改变游戏正文。

## 旧版编辑稿

`chapters/wuzhang/五丈原_完整剧本与逻辑_编辑稿.md` 和 `chapters/wuzhang/第一轮_转呈未竟_20261016.md` 保留旧版创作记录，不作为当前第一章的同步入口。人工编辑稿不由 JSON 导出覆盖。
