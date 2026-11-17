# Windows 本机部署验证 · 2026-10-18

## 后续 API 配置更新

同日已完善「设置 → AI 服务配置」，并按用户指定将 DeepSeek 密钥保存在被 Git 忽略的本机 `.env`。当前服务地址为 `https://api.deepseek.com`，默认模型为 `deepseek-flash`；通过模型列表接口确认可用，再通过配置页的「保存并测试连接」实际调用成功。密钥不写入源码、网页构建产物或本记录。

新增服务地址与模型编辑、模型候选、DeepSeek 默认值、密钥显示/隐藏、未保存提示、保存并测试连接；`?settings=1` 可直达配置。Chrome / Edge 的配置页回归测试覆盖 9 项场景，1280×720 下内容可滚动访问。以下表格中的「未配置密钥」描述首次部署时的状态；当前代理已配置，尚未将一次简短连接测试视为全剧情真实 AI 通关验收。

## 结论与部署范围

浏览器版已在 Windows 本机安装、构建并启动。Chrome 与 Edge 均可打开主菜单、设置、调查场景和关卡地图，收集告示证据后刷新可恢复物品；四段当前视频均实际解码并开始播放。没有页面运行异常或资源 404。

本机尚未配置 AI 密钥：代理正常运行，健康检查返回 `configured: false`，生成接口按设计返回 503。因此当前结论覆盖浏览器版部署及本地代理，不代表使用真实模型完成两轮交涉或完整通关。剧情测试使用本地判定样例，API 测试使用隔离配置与模拟服务。

## 环境与服务

- 基线：`origin/main`，提交 `37b53eb6862a0935508bb6e805a191b5c656a1a5`。
- 本地工作分支：`codex/local-deployment`。
- 系统：Windows，系统报告版本 `10.0.26200`；PowerShell `7.6.5`。
- 运行时：Node.js `24.16.0`，npm `11.13.0`。
- 项目位于包含中文的工作路径；完整仓库、剧情、美术、音频、视频已拉取，`git lfs fsck` 通过。
- 游戏页面：<http://127.0.0.1:8811>。
- AI 代理：<http://127.0.0.1:8787/health>，仅监听本机。
- 本机 `.env` 由空白模板建立；未填入凭据，且被 Git 忽略。
- 两个 Node 服务在后台运行；日志和进程记录位于被 Git 忽略的 `outputs/local-deployment/`。重启电脑后按下方命令重新启动。

## 验证矩阵

| 验证 | Windows 本机结果 |
| --- | --- |
| `npm.cmd ci` | 通过；安装 3 个包，npm 报告 0 个漏洞 |
| `npm.cmd run check` | 叙事 TypeScript 检查通过 |
| `npm.cmd run build` | 浏览器 TypeScript 编译及资源复制通过；无待补素材 |
| `npm.cmd test` | 63 / 63 通过，无跳过 |
| `npm.cmd run test:api` | 修正权限断言后 2 / 2 通过，无跳过 |
| `npm.cmd run validate:story` | 73 个节点、11 个行动结构与引用验证通过 |
| `npm.cmd run check:assets` | 121 项精确大小写资源检查、4 段视频源文件与构建产物哈希通过 |
| `SMOKE_BROWSER_CHANNEL=chrome` 下运行 `npm.cmd run test:smoke` | 主页、设置密码框、跳过旁白进入游戏、4 段视频 HTTP Range 检查通过 |
| Chrome / Edge 补充检查 | 主菜单、设置、调查、收集告示、刷新恢复证据、关卡地图通过 |
| 桌面分辨率 | 两个浏览器在 1280×720、1366×768、1920×1080 下的主菜单无横向溢出；调查流程在 1440×900 下验证 |
| 视频实际播放 | 两个浏览器均能解码并开始播放全部 4 段 H.264 视频，尺寸为 1280×720 |
| 前后端常驻运行 | 8811 页面 HTTP 200；8787 健康检查通过 |
| 未配置密钥 | 跨端口本机请求正确返回 503，无真实模型调用 |
| macOS / Cocos / Windows 原生 EXE | 本轮未验证；仓库当前交付面为浏览器版 |

补充浏览器检查采用独立上下文，不修改日常浏览器的玩家存档；视频验证覆盖加载、解码及起播，没有逐帧检查整段内容。

## 问题与修复

`GameStarter/server/server.test.mjs` 的设置测试最初失败：将 `stat().mode & 0o777` 固定断言为 Unix 的 `0600`，Windows 实测为 `0666`。Windows 文件权限由 ACL 管理，Node 的 `stat` 模式不能证明 Unix 用户/组权限。

修复仅将 POSIX 权限断言限制到非 Windows 平台；Windows 继续完整执行设置校验、拒绝跨站请求、原子保存、更新后立即生效、无关选项保留及重启恢复等断言。服务保存逻辑仍使用原有的临时文件和重命名流程；本轮未验证 Windows ACL 是否仅允许当前用户访问。修正后 API 测试全部通过。

运行 Windows 兼容性静态审计后共出现 104 条模式匹配候选。这些是待核对的静态提示，并非 104 个已确认故障。核心安装、构建和运行入口已用原生 Windows 命令及浏览器实测；macOS 打包中的 `clang`、`codesign`、`ditto` 和音频加工工具不属于浏览器版启动依赖。

## 清理记录

未删除或迁移原始素材、`.meta`、剧情或历史文件。依赖、构建、运行配置、浏览器截图及验证结果保留在原有 Git 忽略目录；源码变更为权限测试修正与 Windows 验证文档更新。

## 后续启动

在项目根目录打开两个 PowerShell 终端，分别运行：

```powershell
# 终端一：构建并启动游戏页面
npm.cmd start
```

```powershell
# 终端二：启动本机 AI 代理
npm.cmd run start:api
```

两个服务当前已启动时无需重复运行。在游戏「设置」中填写自己的服务网址、模型和 API 密钥，随后进行真实交涉验收。请保持使用 `http://127.0.0.1:8811`，浏览器存档按站点地址区分。

## 本地验收附件

- `outputs/migration-20261018/browser-smoke.json`：仓库自带 Chrome 冒烟结果。
- `outputs/local-deployment/verification.json`：Chrome / Edge 补充检查结果。
- `outputs/local-deployment/verify.mjs`：本轮补充检查脚本，可在服务运行时重放。
- `outputs/local-deployment/*-main-menu.png`、`*-evidence.png`：页面截图。
- `outputs/local-deployment/services.json`：本次后台进程编号；停止前须核对编号仍属于本项目，不能复用为下次启动记录。

这些附件仅保留在本机，不进入 Git。浏览器版可在上述已验证范围内使用；完整体验还需真实 AI 与全流程人工验收。
