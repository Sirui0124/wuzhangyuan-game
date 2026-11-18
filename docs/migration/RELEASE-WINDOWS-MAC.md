# Windows 安装版与 Mac 本地网页版发布流程

2026-11-18，适用于当前网页工程。用户已暂停 Unity 移植；UnityPort 保留为历史试验，不进入玩家分发包。本流程替代继续双线移植的交付安排。

## 交付内容

- Git 保存完整源码、各章剧情和设计文档、现用及在制素材、项目规则和发布脚本。Unity 历史试验仍保留。
- GitHub 公开仓库 `Sirui0124/wuzhangyuan-game` 的 Release 保存 Windows x64 NSIS 安装 EXE、Mac 本地网页版分发文件与 SHA256SUMS.txt。2026-11-18已按用户要求由私有转为公开。构建产物不进入 Git。
- Mac 包含 Apple Silicon 与 Intel 的 Node 24.22.3 官方运行时，SHA-256 固定于构建脚本。此 tar.gz 是 Mac 必需的分发包，不额外生成源码压缩备份；本地同时保留完整原文件夹。
- 凭据、玩家存档、缓存、依赖安装目录和本机开发工具不上传。AI 密钥由玩家在设置中配置。
- 2026-11-18用户确认：默认服务网址固定为 `https://api.deepseek.com`，默认模型为 `deepseek-flash`，首次配置只需玩家填写自己的 API key。发布包不预置任何真实密钥，已有用户自定义配置不覆盖。

## 一次准备

Windows 构建机安装 Node、Git LFS、GitHub CLI 和系统 tar。执行：

```powershell
npm ci
npm ci --prefix GameStarter/packaging/windows --no-audit --no-fund
node GameStarter/packaging/windows/node_modules/electron/install.js
gh auth login
```

Electron 与 electron-builder 使用 packaging/windows/package-lock.json 固定版本。Mac 运行时由官方 nodejs.org 下载并逐一核验固定哈希，升级版本必须同时更新启动脚本及哈希。

## 构建

2026-11-18本次及后续默认玩家包只包含第一章、第四章。第二章、第三章和其他未开放章节仅从分发副本排除，本地源码与素材不删除；须经用户明确要求才重新加入。`release-profile.mjs` 在独立暂存副本配置章节、清理独立剧情与入口、筛选实际引用素材，再遍历运行依赖；共享兼容代码保留。普通本地网页构建仍包含完整工程。

排除清单与节省字节记录在载荷manifest的optimization中。第一章剧情内直接引用的影片与字幕也必须保留。Windows使用normal无损压缩，不降低素材画质；Mac从校验过的官方运行时提取bin/node和LICENSE，不打包npm、头文件和开发手册。构建后运行 `node --test GameStarter/packaging/windows/stage-payload.test.mjs GameStarter/packaging/windows/release-profile.test.mjs` 验证剪裁不影响原文件和必要依赖。

```powershell
npm run build:delivery
```

此入口检查架构和网页类型，只构建一次完整网页；Windows 与 Mac 从同一构建准备载荷，分别写入 `outputs/windows-release-标签/` 和 `outputs/mac-web-标签/`。标签使用 UTC 时间戳；旧产物不覆盖。Windows 白名单验证运行依赖、静态引用和文件哈希；Mac 复用白名单，将 API 地址指向固定本机端口 18812，并内置仅监听回环地址的代理及服务。

单独打包入口为 `npm run build:windows` 与 `npm run build:mac-web`。Mac 可用 `-- --build=已有网页构建目录 --label=唯一标签` 复用同一版本。

## 验证

先运行 `npm run test:stability` 与 `npm run test:release:browser`，保留实际结果。失败不能改写为通过；未解决的完整回归失败须在 Release 说明列出，并以预发布版交付。

Windows 将 win-unpacked 复制到 `%LOCALAPPDATA%/WuzhangyuanReleaseTests/标签/unpacked/`，执行：

```powershell
node GameStarter/packaging/windows/test-installed.mjs "独立目录/Wuzhangyuan.exe" --release-output=outputs/windows-release-标签 --unpacked-probe --skip-captures --current-access
```

`--current-access` 对应当前仅第一章和第四章开放的状态，验证其他章节保持关闭，不为测试改游戏规则。以后开放章节时同步维护测试。此检查验证程序实启、视频、设置、独立存档、重启恢复及服务退出；不等于 NSIS 安装、升级和卸载验证。需要完整安装验收时，在隔离的 Windows 测试账户安装 EXE，再移除 `--unpacked-probe` 指向该次 app 安装目录执行，并实际验证升级与卸载。

Mac 解压后，在终端执行 `bash ` 加启动脚本路径（可以将“启动游戏.command”拖入终端）。包内运行时按芯片选择，无需安装 Node/npm。浏览器打开 `http://127.0.0.1:18812/`；终端保持运行，Ctrl+C 退出。后端数据位于 `~/Library/Application Support/WuzhangyuanWeb`，普通章节进度在浏览器。升级保留此目录和浏览器数据。

可在 Windows 用本机 Node 启动解包目录的 launch.mjs 做跨平台代码检查；先设置 `WUZHANG_TEST_DATA` 指向 outputs 下独立测试目录，避免真实玩家数据。服务启动后执行：

```powershell
node tools/release/test-web.mjs outputs/mac-web-标签/validation
```

这只代表 Windows Chrome 验证。Mac 芯片运行时执行、Safari、权限/Gatekeeper 和终端退出行为须在 Mac 实机另验，不从 Windows 结果推断通过。不要把本机测试数据放入已完成的分发包。

每次发布另运行 `node tools/release/verify-default-settings.mjs "Windows独立目录/Wuzhangyuan.exe" "Mac解包目录"`。此检查用隔离用户目录验证两个产物的默认网址、模型、初始空密钥，以及只填写测试密钥即可保存并重新读取；不调用真实模型。不要以旧版测试替代新产物验证。`test-web.mjs` 另核对仅第一章、第四章配置、排除章节404、剧情内嵌影片引用，以及第四章两种入口的后端会话。

## 提交与发布

核对本次源码和构建来源未发生变化；比较 Git 改动并检查敏感内容，再提交。用新的标签，保留历史版本。发布说明必须包含开放章节、构建版本、验证结果与限制。

```powershell
git add -A
git commit -m "release: Windows and Mac web snapshot"
npm run publish:github -- --tag=v2026.11.18-snapshot --windows=outputs/windows-release-标签 --mac=outputs/mac-web-标签 --notes=docs/migration/本次发布说明.md
```

发布脚本要求工作区干净、目标仓库仍为用户指定的公开仓库；核对本地两种产物的 SHA-256，推送独立 delivery 分支，创建草稿 Release，再上传产物和校验文件，核对远端大小与GitHub报告的SHA-256后设为预发布。不会强推或替换 main，不自动覆盖同名 Release。中断时保留草稿，检查已上传资产后继续；不可用 `--clobber` 直接覆盖已有正式产物。

下载时使用 Release 附件。GitHub 的自动 Source code 下载不等同玩家安装包，源码恢复须使用 Git LFS：`git clone` 后执行 `git lfs pull`。
