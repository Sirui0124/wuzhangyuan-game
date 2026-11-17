# Windows 安装与启动

## 需要带走什么

复制整个工作区，或克隆整个私有仓库。`GameStarter` 的构建会读取上级的 `content`、`source-art` 和 `video/current`，单独复制工程无法还原游戏。原始 `.meta` 必须和资源一起带走。

建议放到短路径，例如 `C:\work\wuzhang`。文件名保留中文，使用 UTF-8；本次扫描没有发现 Windows 禁用名称、尾随点/空格、大小写或 Unicode 规范化冲突。短路径能减少 Git、Cocos 和额外工具的路径长度问题。

## 安装依赖

安装 Node.js 22 或更新版本、Git for Windows；另装 Git LFS（仓库大素材必需）。核心 HTML 游戏不需要安装 Cocos、Python、FFmpeg 或 macOS 工具。

首次克隆时，先登录有访问权限的 GitHub 账号，在 PowerShell 中执行：

```powershell
git lfs install
git clone https://github.com/Sirui0124/wuzhangyuan-game.git C:\work\wuzhang
Set-Location C:\work\wuzhang
git lfs pull
git lfs fsck
```

接着安装和启动：

```powershell
Set-Location C:\work\wuzhang
node --version
npm.cmd --version
npm.cmd ci
npm.cmd run open
```

以后直接双击工作区根目录的 **`启动游戏.cmd`**，会启动后台服务并打开 http://127.0.0.1:8812/local/ 。可为启动器创建桌面快捷方式；重复启动会复用本项目服务。点击“进入最新游戏”开始试玩。代码、剧情与已接入素材改动会自动构建，失败仍保留上一可玩版。使用 `npm.cmd` 可避免 PowerShell 执行策略拦截 `npm.ps1`，无需放宽系统策略。架构和日志见[本地访问说明](../design/LOCAL-GAME-ACCESS.md)。

## AI 代理

启动器会自动启动或复用本机 8787 代理。配置密钥时，可在游戏设置填写，或首次在工作区根目录执行：

```powershell
# 仅首次创建；已有 .env 时不要覆盖。
if (-not (Test-Path GameStarter/server/.env)) {
  Copy-Item GameStarter/server/.env.example GameStarter/server/.env
}
notepad GameStarter/server/.env
```

在 `.env` 填入自己的 `DEEPSEEK_API_KEY`，网址和模型以实际服务账户支持为准，也可启动后从游戏设置保存。文件配置优先于同名进程环境变量。不要把密钥粘贴到脚本、README、截图或提交里。

默认代理地址 http://127.0.0.1:8787 ，健康状态为 `/health`。没有密钥也可启动代理，但生成请求返回 503。浏览器前端默认连本机 8787；若改变 `PORT`，也需相应配置前端代理地址，普通安装请保留默认值。

编辑 `.env` 后运行 `npm.cmd run stop`，再双击启动器；游戏内保存配置则立即生效。可选环境变量：`DEMO_PORT` 控制网页端口，仅建议隔离测试使用；日常固定 8812。`GAME_SETTINGS_FILE` 指向独立可写配置文件。示例（先关闭旧服务）：

```powershell
$env:GAME_SETTINGS_FILE = 'C:/work/wuzhang-private/.env'
# 文件中的保存配置优先，密钥由编辑器或游戏设置填写。
npm.cmd run open
```

`npm.cmd run stop` 关闭本项目管理的后台服务，不删除存档；它不会关闭其他终端独立启动的代理。开发者可用 `npm.cmd start` 在当前终端运行同一服务，Ctrl+C 关闭。仅调试代理时，仍可独立使用 `npm.cmd run start:api`。

## 验证

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:api
npm.cmd run validate:story
npm.cmd run check:assets
npx.cmd playwright install chromium
npm.cmd run test:smoke
```

`check:assets` 要先构建，核对引用路径的精确大小写与视频哈希。最后两步是可选浏览器检查，需要下载 Chromium；若已经安装 Chrome：

```powershell
$env:SMOKE_BROWSER_CHANNEL = 'chrome'
npm.cmd run test:smoke
```

预期：主页、设置、旁白跳过、游戏场景及四段视频可打开，无页面异常或 404。AI 真服务需另行用自己的账户试玩两轮交涉；当前自动测试不会调用付费 AI 服务。

## Cocos 与额外工具

需要编辑 Cocos 时，在 Windows 的 Cocos Dashboard 安装 **3.8.8** 并打开 `GameStarter`，让编辑器自己重建 `temp` 和 `library`。根 `tsconfig.json` 继承的 `temp/tsconfig.cocos.json` 由编辑器生成，不能从 Mac 缓存复制代替。完整玩法目前以 HTML 版为交付面，尚无 Windows 原生 EXE。

旧版 `package:mac` 命令及打包脚本已退出维护；当前使用浏览器版。当前保留的音频加工脚本需要 Python 与 FFmpeg，仅用于重新加工现用原音频；不属于安装、启动或构建步骤。旧剪辑、转写和审片过程工具已清理，最新剪辑来源与时间线见 `video/in-progress/edits/manifest.json`。

## 存档和配置

浏览器存档位于原浏览器的 localStorage，Mac 独立应用存档位于 WKWebView 的用户资料，不属于项目源码。直接搬工程不会自动带走存档。需要继续旧进度时，在原游戏页面开发者工具导出以 `wuzhang` 开头的 localStorage 项，保存在私有文件；在 Windows 同版本游戏、同一站点地址导入前先备份新机存档。游戏内草稿和备份也可能含玩家文本，不加入 Git。

网页地址需保持一致；`localhost` 与 `127.0.0.1`、不同端口各有独立存储。旧 Mac 应用的本机 API 配置不自动迁移，请在 Windows 重新填写自己的密钥。

## 常见问题

- `Cannot find module typescript`：回到根目录运行 `npm.cmd ci`，不要依赖全局 tsc。
- 端口被占：启动器会复用同一项目的服务；若是原 `start:demo` 或别的程序，请在其原终端关闭。不要直接结束不明进程或随意换端口，否则浏览器会使用另一份存档。
- 视频是文本指针或不能播放：若使用 LFS 克隆，运行 `git lfs pull`，再构建。
- 页面存在但交涉不可用：确认 8787 代理已启动、密钥可用、服务账户支持该模型。
- Cocos 报缺少生成的 tsconfig：在 Creator 3.8.8 打开工程生成配置；HTML 构建不依赖此文件。

2026-10-18 已在 Windows 本机（Node.js 24.16.0、PowerShell 7.6.5）完成依赖安装、构建、63 项剧情测试、2 项 API 测试与资源检查；Chrome 和 Edge 均通过页面、证据存档恢复及四段视频解码播放检查。详见 [Windows 本机验证记录](WINDOWS-VALIDATION-20261018.md)。真实 AI 自由输入仍需填写自己的密钥后验收；Cocos 编辑器和 EXE 尚未验收。
