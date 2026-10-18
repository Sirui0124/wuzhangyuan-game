# 统一剧情内容目录

玩法规则与文件职责以 `../docs/统一玩法与文本规范_v1.md` 为准。

- `schema/narrative.ts`：唯一的剧情格式契约。字段修改先更新此文件和规范，不在章节中自创结构。
- `../docs/剧本对话编写指南与示例_v1.md`：编剧节点卡、字段映射、举证反馈、行动兑现及失败回溯的写作指南。
- `examples/wuzhang-authoring.example.ts`：摘自正式章节的对话、判定、行动、承诺和事件样例；用于格式参考，不是独立章节。
- `examples/dialogue-format.example.ts`：普通调查、举证自由输入的格式样例，引用未完整定义，不可当作可运行章节。
- `chapters/wuzhang/chapter.json`：五丈原正式章节。所有 flag、场景、人物、证据、对话、行动、判定和事件汇总在一个文件。
- `chapters/wuzhang/notes.md`：史料边界、对白说明、待讨论内容。运行时不读取此文件。
- `chapters/wuzhang/walkthrough.md`：两条核心路线及失败路线的预期状态变化。

章节内容目录为创作源文件。后续打包脚本验证通过后，将 JSON 复制到 `GameStarter/assets/resources/story/` 供 Cocos 读取；运行资源不手改，已有 `.meta` 必须保留。原始视频、音频和图片放 `../source-art/wuzhang/`，上线资源由 UI/资源工作流导入工程。

正式 `chapter.json` 是剧情内容源；样例修改不会改变正式剧情。格式校验、运行时验证与实际试玩分别确认。

## 用户改稿流程

`chapters/wuzhang/五丈原_完整剧本与逻辑_编辑稿.md` 是供用户修改的完整伪代码稿，保留所有节点 ID、对白、条件、效果和分支。用户修改后通知 Codex，再核对并落实到正式 `chapter.json`、校验和 demo。不要用 JSON 导出覆盖人工编辑；`scripts/export-wuzhang-review.py` 遇到已有编辑稿会停止。原有最终对白阅读稿作为此前版本参考，用户后续修改以完整编辑稿为准。
