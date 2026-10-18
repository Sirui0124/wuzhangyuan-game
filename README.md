# 逆转五丈原 · 开发工作区

当前可运行版本采用 HTML + TypeScript，默认在桌面浏览器试玩。Cocos Creator 工程版本为 3.8.8，`Main.scene` 尚未接入完整玩法。请复制或克隆**整个目录**，不要只带走 `GameStarter`。

## 安装与启动

安装 Node.js 22 或更新版本，在本目录运行：

```sh
npm ci
npm start
```

打开 http://127.0.0.1:8811 。另开终端配置并启动本地 AI 代理：

```sh
# macOS / Git Bash；PowerShell 复制命令见 Windows 文档
cp -n GameStarter/server/.env.example GameStarter/server/.env
npm run start:api
```

填写本机 `.env` 的密钥，或在游戏设置中填写。代理只监听本机 8787；没有密钥时可打开游戏和设置，AI 交涉不可用。请勿把填好的 `.env`、旧 Mac 发布包或浏览器存档上传。

## 目录职责

| 目录 | 内容 |
| --- | --- |
| `GameStarter/` | 有效游戏源码、测试、网页发布资源、AI 代理与 Cocos 工程 |
| `content/` | 剧情格式、正式 JSON、完整人工编辑稿、最新第一轮确认稿与路线说明 |
| `docs/` | 当前编写规范、核心架构和迁移指南 |
| `source-art/visuals/` | 当前美术原件与绑定索引 |
| `source-art/audio/` | 现用音频的原件、许可及加工工具 |
| `video/current/` | 当前四段影片，包含仍在使用的 legacy fallback |
| `video/pending/`、`video/in-progress/` | 待接入素材、最新原片、参考图与六段优选剪辑 |
| `tools/migration/` | 审计、资源引用核对与浏览器冒烟工具 |

运行内容以 `content/chapters/wuzhang/chapter.json` 为准。人工编辑稿与最新 `第一轮_转呈未竟_20261016.md` 共同保留；人工稿正文尚未完全反映最新第一轮，修改后须核对 JSON。AI 判定提示词仅以 `GameStarter/assets/scripts/narrative/weiyan-first.ts` 和 `weiyan-second.ts` 源码为准。

图片生成 Prompt、历史过程稿、无关研究参考、旧版审片和重复加工输出已从当前版本移除，本机原文件进入废纸篓。Git 历史仍保留先前提交的恢复记录。

## 验证

```sh
npm run check
npm test
npm run test:api
npm run validate:story
npm run build
npm run check:assets
```

可选浏览器检查：先运行 `npx playwright install chromium`，再运行 `npm run test:smoke`。已安装 Chrome 时，可设置 `SMOKE_BROWSER_CHANNEL=chrome` 使用它。测试使用独立浏览器上下文，不读写现有玩家存档。`npm test` 采用本地判定样例，不代表真实 AI 质量。

## 迁移与文件清单

- [Windows 安装、启动和故障处理](docs/migration/WINDOWS.md)
- [文件索引与素材清单](docs/migration/FILES.md)
- [GitHub 上传边界、大文件和 LFS 建议](docs/migration/GITHUB.md)
- [保留与待确认项](docs/migration/PENDING.md)
- [本次本地整理报告](docs/migration/REPORT.md)

Git 管理范围覆盖整个工作区。私有仓库：[Sirui0124/wuzhangyuan-game](https://github.com/Sirui0124/wuzhangyuan-game)。视频、WAV / MP3、PNG 和设计源工程通过 Git LFS 管理；克隆前安装 Git LFS，克隆后执行 `git lfs pull`。本地原件、密钥和被忽略的旧发布包不受影响。

资源与相邻 `.meta` 一起保留。`library`、`temp`、`local`、`.build`、`node_modules` 等为本机生成内容，重新安装/构建即可，不迁移缓存。
