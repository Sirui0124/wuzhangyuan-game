# 文件索引

| 内容 | 当前入口 |
| --- | --- |
| 安装、启动、构建、测试 | 根 package.json、package-lock.json、README.md |
| 游戏交互 / 状态与 AI | GameStarter/web-demo/src/、GameStarter/assets/scripts/narrative/ |
| AI 判定提示词 | GameStarter/assets/scripts/narrative/weiyan-first.ts、weiyan-second.ts |
| 本机代理 | GameStarter/server/server.mjs、.env.example |
| 正式剧情 | content/chapters/wuzhang/chapter.json、endings.json |
| 人工剧本 | 同目录完整编辑稿与第一轮_转呈未竟_20261016.md；后者是最新首轮确认 |
| 当前美术 | source-art/visuals/runtime/，实际绑定为 GameStarter/web-demo/visual-assets.json |
| 当前影片 | video/current/，实际绑定为 GameStarter/web-demo/public/video/media-manifest.json |
| 当前音频 | GameStarter/web-demo/public/audio/；source-art/audio/ 保存实际使用的原音频与许可 |
| 在制视频 | video/in-progress/raw、references、edits；edits/manifest.json 为最新六段剪辑索引 |
| 格式规范与架构 | docs/ 的三份编写 / 架构说明、content/schema/ |
| 迁移审计 | tools/migration/；本机证据在被忽略的 outputs/migration-20261018/ |

ASSETS.csv 和 VIDEOS.csv 只列当前 Git 交付素材，含大小、SHA-256 和 LFS 规则。图片 Prompt、旧过程稿、研究素材、审片输出和重复发布副本已移入本机废纸篓，不在当前交付树中。Git 先前提交及完整私有检查点保留恢复记录。现用源美术、发布音频、最新视频和原有 .meta 保留。
