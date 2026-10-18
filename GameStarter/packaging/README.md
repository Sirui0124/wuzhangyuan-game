# macOS 独立发布工具

仅支持 macOS，使用 AppKit + WKWebView、本地 Node 运行环境及 AI 代理。Windows 迁移使用[浏览器版启动步骤](../../docs/migration/WINDOWS.md)，当前没有 Windows EXE。

先在工作区根目录安装依赖，再在 `GameStarter` 执行 `npm run package:mac`。构建需要 FFmpeg、Apple Command Line Tools、clang、codesign 和 ditto。默认输出到 `../../releases/macos/`，包含应用、ZIP 和哈希清单，全部排除 Git。

2026-10-18 起构建使用空密钥默认配置，不再读取 `server/.env` 打入包中。首次启动把空配置写入用户资料，玩家在设置中填写自己的密钥；已有配置保留。Mac 用户配置默认位于 `~/Library/Application Support/逆转五丈原/.env`，权限 600。

`node packaging/verify-release.mjs --fixture` 是历史包体验证工具，已移除个人机器的 Playwright 绝对路径并调整空密钥检查。其剧情路线和原生签名仍需在重新打包后复核；本次没有运行它或重新签名、打包。当前本地迁移验证使用根目录 `npm run test:smoke`。

历史发布包中发现过默认密钥，原件保留本地且排除上传。不要直接把旧包发布为 GitHub Release。新构建行为经过源码检查；完整 Mac 包构建、原生启动及 Intel/Windows 实机不属于本次已验收项。
