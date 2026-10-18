# 文件索引与素材清单

请迁移整个工作区。目录分工见根 README；保留现有稳定路径，迁移资料集中于本目录，审计工具集中于 `tools/migration/`。

| 内容 | 权威入口或维护位置 |
| --- | --- |
| 网页构建 / 启动 | 根 `package.json` → `GameStarter/web-demo/build.mjs`、`serve.mjs` |
| 游戏交互 | `GameStarter/web-demo/src/` |
| 叙事状态机和 AI 判定 | `GameStarter/assets/scripts/narrative/`，重点 `weiyan-first.ts`、`weiyan-second.ts`、`weiyan-api.ts` |
| AI 本地代理 | `GameStarter/server/server.mjs`；环境变量模板 `.env.example` |
| 剧情人工编辑 | `content/chapters/wuzhang/五丈原_完整剧本与逻辑_编辑稿.md`；同目录最新补充稿、最终对白与 review 文件均保留，未擅自合并 |
| 实际运行剧情 | `content/chapters/wuzhang/chapter.json`、`endings.json`；与人工稿需要同步核对 |
| 美术绑定 | `GameStarter/web-demo/visual-assets.json` → `source-art/五丈原_游戏资产库_v01/` |
| 视频白名单 | `GameStarter/web-demo/public/cinematics.json`、`public/video/media-manifest.json` → `video/current/` 四段 |
| 音乐与音效 | `GameStarter/web-demo/public/audio/`，原始素材与接入记录在 `source-art/` |
| 创作提示词 | `source-art/` 各版本的 Markdown / JSON；AI 判定提示词另见上列 TypeScript |
| 项目导演规范与参考图快照 | `docs/creative-reference/wuzhangyuan-cinematic-direction/`，原个人技能目录的项目相关内容已本地化 |
| 新视频与审片 | `video-new/`、`video/pending/`、`video/review/20261018_v01/`、`20261018_v02/` |
| 外部生成参考图的本地原件 | 原有相同图片优先复用，缺失的副本补入 `source-art/reference-originals/generated/`；30 条 JSON 引用已改为可迁移的相对路径 |
| 历史设计与交接 | `docs/`、`source-art/` 各版本目录及 `video/legacy/`，尚未证明过期的均保留 |
| 本地审计和验证证据 | `outputs/migration-20261018/`，忽略上传，可随本地迁移单独保管 |

`ASSETS.csv` 为交付时素材快照，含相对路径、字节数、SHA-256、Git 候选状态和 LFS 建议；`VIDEOS.csv` 单列全部视频。Git 候选表示未被忽略，**不表示已上传、授权发布或已经选择 LFS**。完整文件索引可运行 `npm run audit:migration`，输出 `outputs/migration-20261018/file-inventory.csv`。

构建时会按清单将源美术与视频复制进 `.build`；这些副本与原件相同是正常依赖关系。音频 prepared / public 两份分别承担加工来源与发布资源职责，暂不去重。`.meta` 与原资源配对保存。
