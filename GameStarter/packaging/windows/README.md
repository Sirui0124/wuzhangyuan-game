# Windows 安装版

此目录维护《逆转五丈原》的 Windows x64 安装版。游戏仍使用现有网页、剧情与音视频；Electron 提供窗口和运行时，本机 Node 后端作为应用子进程运行。玩家无需安装 Node、npm、TypeScript 或 Cocos Creator。

固定构建版本为 Electron 45.0.0、electron-builder 26.18.0，依赖由本目录的 `package-lock.json` 锁定。Electron 官方当前稳定版包含 Chromium 156 与 Node 24.22.0；实际发布版本应以安装产物的检查记录为准。[Electron 官方版本](https://releases.electronjs.org/?channel=stable)

## 文件与数据

- `main.cjs`、`backend-child.cjs` 是桌面启动与本机服务入口，打入 `resources/app.asar`。
- `stage-payload.mjs` 按发布白名单从本次完整网页构建及当前后端源文件准备载荷，生成逐文件大小与 SHA-256 清单。
- `verify-payload.cjs` 在资源复制完成后、生成安装器之前核对清单中每个文件的大小和 SHA-256，并拒绝清单外的文件。
- `resources/game/web` 保存预编译网页和发布资源，后端入口位于 `resources/game/GameStarter/server`。大视频在 ASAR 外，便于 Range 读取。实时配音退役后，分发包已移除配音模块及其 `ws` 依赖。
- API 配置和游戏用户数据由启动器写到当前用户的独立可写目录，不写安装目录。卸载配置保留用户数据；旧浏览器试玩存档不会自动进入 Electron 的独立浏览器资料。
- 游戏本机服务使用应用自己的进程；启动器不关闭已有开发服务，不把真实凭据或玩家存档复制进安装载荷。

## 构建

从工作区根目录执行。先准备新的完整网页构建，不能依赖其他任务正在反复生成的默认 `.build`。这里的示例路径是 2026-10-27 16:30 的单次产物；后续使用新的日期时间标签，保留之前的安装器。

```powershell
npm ci --prefix GameStarter/packaging/windows --no-audit --no-fund
$env:ELECTRON_CACHE = Join-Path (Get-Location) '.cache/windows-tooling/electron'
node GameStarter/packaging/windows/node_modules/electron/install.js
node GameStarter/web-demo/build.mjs .cache/windows-release-20261027-1630/web-build
$env:GAME_BUILD='.cache/windows-release-20261027-1630/web-build'
node tools/migration/check-assets.mjs
node GameStarter/packaging/windows/build-release.mjs --build .cache/windows-release-20261027-1630/web-build --stage .cache/windows-release-20261027-1630/stage --output outputs/windows-release-20261027-1630 --label 20261027-1630
```

`--skip-stage` 只适用于已经通过清单校验的同一份 stage。新源码或后端变化后须重新准备载荷。`--version` 可覆盖安装版版本，`--label` 用于区分本次文件名；脚本拒绝覆盖已有的同名安装器。

打包直接使用本目录 `node_modules/electron/dist` 中已安装的锁定版本，避免构建时再次下载 Electron。安装验证覆盖当前六个章节入口、夷陵服务端存档、应用重启恢复，以及本次媒体交接清单中的视频和字幕。

修复发布使用两步构建。先加 `--dir` 生成目录版，复制到工作区之外、祖先目录没有项目依赖的位置，验证启动和本机服务。通过后用 `--prepackaged` 对同一个目录生成 NSIS，脚本会再次核对全部载荷文件，electron-builder 不再重新复制应用。

```powershell
node GameStarter/packaging/windows/build-release.mjs --build .cache/windows-release-20261027-1630/web-build --stage .cache/windows-release-20261027-1630/stage --output outputs/windows-release-20261027-1655-repair --label 20261027-1655-repair --skip-stage --dir
# 在独立目录完成实际启动检查后，再执行下一条。
node GameStarter/packaging/windows/build-release.mjs --build .cache/windows-release-20261027-1630/web-build --stage .cache/windows-release-20261027-1630/stage --output outputs/windows-release-20261027-1655-repair --label 20261027-1655-repair --skip-stage --prepackaged outputs/windows-release-20261027-1655-repair/win-unpacked
```

`electron-builder.config.cjs` 采用 NSIS x64、当前用户安装、可选择目录、桌面和开始菜单快捷方式，以及自动生成的卸载器。安装不请求管理员权限，完成安装后不擅自启动游戏。卸载保留用户数据。构建只生成本机安装器，不发布、不上传、不购买签名，当前产物未签名。2026-11-02 本轮安装包采用用户要求补充墨绿背景、远山和古铜边框的续命灯图标，统一用于安装器、卸载器、游戏程序与窗口；1024px 母版为 `resources/icon.png`，运行 `resources/make-icon.ps1` 从母版重建 16–256px 的十档 ICO。预览为 `resources/icon-preview.png`；生成原图与用户选择记录在本次输出目录中保留。[NSIS 官方文档](https://www.electron.build/docs/nsis/)

2026-11-18发布优化改用 `compression: 'normal'`，对安装载荷无损压缩，不重新编码音视频。发布配置只保留第一章、第四章；其他章的本地源文件保留，待用户明确要求再加入。清单记录排除文件及原因。

## 检查结果

`release-artifacts.json` 记录安装器文件大小、SHA-256 和构建版本。目录构建不标记 `installerGenerated`；NSIS 构建成功后才标记。脚本不会自行将安装、启动和卸载标为通过。实际安装验证由另行保存的验证脚本和报告记录。

必须分别验证安装器生成、实际安装、安装后启动、静态资源与本机 API、退出后的服务清理、升级时进度保留和卸载。测试使用独立安装目录与用户数据，不使用玩家真实资料。Android APK 未包含在这条构建路径中。

## 快速打包入口（2026-11-17）

工作区根目录执行 `npm run build:windows`，或双击根目录的 `打包Windows.cmd`。命令先检查架构，再在独立时间戳目录构建网页、准备载荷并生成NSIS安装程序；不会覆盖已有安装包。需要本机已安装本目录package-lock锁定的打包依赖。

只需要目录版时执行 `npm run build:windows -- --dir`。输出位于 `outputs/windows-release-时间戳/`。当前网页与Windows使用同一套游戏代码；UnityPort是独立试验工程，不参与此打包。

当前新增营救指令服务的运行依赖已加入发布白名单，其TypeScript规则在打包时转成JavaScript，Windows不依赖外部TypeScript环境；运行存档使用玩家数据目录。
