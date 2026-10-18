# GameStarter

逆转五丈原的 HTML + TypeScript 游戏、叙事核心、AI 代理和 Cocos Creator 3.8.8 工程。完整源码与素材工作区是上级目录，安装、Git 和 Windows 迁移请从[工作区 README](../README.md)开始。

在**工作区根目录**运行 `npm ci`，再运行 `npm start`（网页 8811）与 `npm run start:api`（代理 8787）。代理的空白配置模板为 `server/.env.example`，本机 `.env` 不进入 Git。TypeScript 与浏览器测试工具由根 package-lock 锁定。

本目录仍支持 `npm run build:demo`、`start:demo`、`check:narrative`、`test:narrative`、`validate:story`、`pack:story`。先完成根目录依赖安装。网页构建读取上级 `content`、`source-art` 和 `video/current`，不能只复制本目录。

正式剧情为 `../content/chapters/wuzhang/chapter.json`。AI 判断逻辑和完整提示词位于 `assets/scripts/narrative/`，API 实现为 `server/server.mjs`。当前测试通过情况见[迁移报告](../docs/migration/REPORT.md)。现行影视引用只以 `web-demo/public/cinematics.json` 和 `web-demo/public/video/media-manifest.json` 为准。

Cocos 主场景 `assets/scenes/Main.scene` 尚未接入完整玩法。浏览器游戏可运行，不代表 Cocos 或原生应用已验收。场景资源及 `.meta` 原样保留。

`npm run package:mac` 仅支持 macOS。自 2026-10-18 起新构建不再把开发者密钥写入 `api-defaults.json`；玩家首次启动须填写自己的密钥。既有旧发布包已移入本机废纸篓，未上传 Git；完整私有检查点可能包含旧密钥，不能分发。
