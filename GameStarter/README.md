# GameStarter

逆转五丈原的 HTML + TypeScript 游戏、叙事核心、AI 代理和 Cocos Creator 3.8.8 工程。完整源码与素材工作区是上级目录，安装、Git 和 Windows 迁移请从[工作区 README](../README.md)开始。

在**工作区根目录**运行 `npm ci`，再双击 `启动游戏.cmd` 或运行 `npm run open`。固定入口为 http://127.0.0.1:8812/local/ ，完整游戏为同地址的 `/`；自动构建及 AI 代理（8787）一起启动。开发者可用 `npm start` 在当前终端运行同一服务。详见[本地访问架构](../docs/design/LOCAL-GAME-ACCESS.md)。代理的空白配置模板为 `server/.env.example`，本机 `.env` 不进入 Git。TypeScript 与浏览器测试工具由根 package-lock 锁定。

本目录仍支持 `npm run build:demo`、`start:demo`、`check:narrative`、`test:narrative`、`validate:story`、`pack:story`。先完成根目录依赖安装。网页构建读取上级 `content`、`source-art` 和 `video/current`，不能只复制本目录。

默认第一章剧情为 `../content/chapters/wuzhang/chapter-one.script.json`，流程配置为同目录 `chapter-one.flow.json`；`web-demo/src/chapters/chapter-one/` 负责本章推进、思绪、表达与恢复；`game.ts` 负责装配，`game/` 负责界面，原 `chapter-session.ts` 保留兼容导出。架构边界见[代码架构](../docs/architecture/README.md)。当前完整接入与验收见[记录](../docs/design/CHAPTER-ONE-INTEGRATION-20261022.md)。旧版网页已移除；`assets/scripts/narrative/` 保留 Cocos 核心及共用类型。API 实现仍为 `server/server.mjs`。影视引用仍以 `web-demo/public/cinematics.json` 和 `web-demo/public/video/media-manifest.json` 为准。

Cocos 主场景 `assets/scenes/Main.scene` 尚未接入完整玩法。浏览器游戏可运行，不代表 Cocos 或原生应用已验收。场景资源及 `.meta` 原样保留。

旧版 macOS 打包脚本及 `package:mac` 命令已退出维护。Windows 安装版沿用网页游戏，发布启动器与 NSIS 构建配置位于 [packaging/windows](packaging/windows/README.md)，使用独立的预编译资源和用户数据目录；玩家不需要安装 Node、TypeScript 或 Cocos。安装器生成、安装后启动及卸载结果分别记录在每次发布报告中。

物品栏及物品收取、赠送、购物、出售、手机和人格评估已移除；线索栏只承载已有剧情信息。旧存档原始数据继续保护，退役字段不再进入运行状态。第四章保留多路营救，使用公共暂停、设置与手动存档界面。当前改动见[剧情与选择架构记录](../docs/architecture/ITERATION-20261117.md)。
