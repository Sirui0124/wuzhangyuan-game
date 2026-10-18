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

| 目录 | 内容与维护方式 |
| --- | --- |
| `GameStarter/` | 游戏源码、测试、网页资源、AI 代理及 Cocos 工程 |
| `content/` | 剧情格式契约、正式章节、最新编辑稿与路线说明 |
| `docs/` | 设计、提示词说明、历史交接及迁移指南 |
| `source-art/` | 原始美术、音频、完整生成提示词、授权说明与加工记录 |
| `video/current/` | 构建白名单引用的四段现用视频，含两段仍在使用的 legacy fallback |
| `video/pending/`、`video/review/`、`video-new/` | 在制视频、审片剪辑成果与新原片；保留但不自动进入游戏 |
| `video/legacy/` | 历史影片，保留作恢复及来源核对 |
| `scripts/` | 剧情审稿、导出和同步工具 |
| `tools/migration/` | 迁移审计、资源引用核对和浏览器冒烟验证 |
| `outputs/`、`releases/` | 本地验证资料与历史发布包，排除 Git 上传 |

运行内容以 `content/chapters/wuzhang/chapter.json` 为准。人工改稿保留 `五丈原_完整剧本与逻辑_编辑稿.md`；改稿后核对并同步 JSON，不能用导出覆盖人工修改。AI 判定提示词在 `GameStarter/assets/scripts/narrative/weiyan-first.ts` 和 `weiyan-second.ts`；所有版本创作提示词均保留。

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
