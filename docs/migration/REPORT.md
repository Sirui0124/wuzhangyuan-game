# 2026-10-18 本地迁移整理报告

已完成本地整理、可重复安装、构建与浏览器冒烟检查；没有提交、暂存、设置远程或上传。现用网页与本地代理已启动供核对。Windows 实机和 Cocos / 原生安装包仍需后续验证。

## 保护与恢复

开始时工作区根目录未纳入 Git；`GameStarter/.git` 无任何提交、对象或远程，文件全部未跟踪。先将全目录 3,639 个文件、2,069,308,964 字节复制到外部检查点并逐文件记录 SHA-256，再把原空 `.git` 移至工作区根目录。没有用 reset / clean 覆盖任何未提交工作。

- 私有全量检查点：`/Users/sirui/Documents/ChatGPT/Game/GameJam-1011-checkpoint-20261018-153936`。含原环境配置，不可上传；内部 `CHECKPOINT.json` 是原始哈希清单。
- 废纸篓：`/Users/sirui/.Trash/GameJam-1011-migration-20261018-154345`。
- 恢复映射：`../../outputs/migration-20261018/trash-manifest.json`。
- 移入废纸篓 5 个文件，共 33,840,818 字节（32.27 MiB）：3 个 `.DS_Store`、2 段已确认与保留录屏完全相同且无引用的 raw 录屏。没有永久删除文件。
- 19 个 `.meta` 全部不变；正式剧情 JSON、人工编辑主稿、本机 `.env` 哈希不变。原始美术与视频逐文件复核结果见 preservation-check.json。

## 目录与兼容性

保留现有代码、素材、剧情与在制视频的稳定目录，把迁移指南统一放入 `docs/migration/`、审计工具放入 `tools/migration/`。根 README、文件索引、Windows 步骤、空白环境变量模板和素材 CSV 已补齐。

增加根 `package.json` 与锁文件，固定 TypeScript / Playwright，统一从根安装启动；TypeScript 构建改为 Node 直接调用，避免 Windows 的 tsc.cmd 执行差异。资源白名单路径判断采用平台分隔符。AI 代理支持无 `.env` 启动，实际联网判定仍需自行配置密钥。

项目内的个人绝对路径已改为相对引用；30 条生成参考图外部引用已匹配项目原件或复制本地原件。原个人技能目录中的导演规范、模板和参考图也保存为 `docs/creative-reference/` 快照并更新链接。旧外部剪辑素材和 MLX 模型路径改由环境变量显式提供；它们不参与游戏启动。Mac 专用打包和转写脚本保留并标明适用平台。

静态扫描没有发现 Windows 非法文件名、NFC / 大小写冲突、超过 200 字符的相对文件路径或符号链接。建议 Windows 使用 `C:\work\wuzhang` 一类短路径；本次是在 macOS 上检查，尚不能替代 Windows 实机验收。

## 已完成验证

| 检查 | 结果 |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | 锁文件安装成功 |
| `npm run build` | 网页 TypeScript 编译及资源组装成功 |
| `npm run check` | 叙事严格类型检查通过 |
| `npm test` | 63 项通过 |
| `npm run test:api` | 2 项通过，使用本地接口样例，未消耗真实 AI 调用 |
| `npm run validate:story` | 73 节点、11 动作结构及引用通过 |
| `npm run check:assets` | 121 项文件 / 大小写引用核对、4 段现用视频哈希通过 |
| Chrome 冒烟 | 主页、设置、进入游戏、跳过旁白、4 段视频 HTTP 分段读取通过，无页面异常或 404 |
| 本地启动 | 网页 8811 返回 200；AI 代理 8787 health 返回 200，现有本机配置有效 |

当前试玩：`http://127.0.0.1:8811/`；代理健康检查：`http://127.0.0.1:8787/health`。服务依赖本机进程，重启电脑后按 README 启动。没有验证真实 AI 交涉质量、全流程所有结局、Windows 实机、Cocos 编辑器集成或 Mac 重新打包。

## Git 与敏感文件

扫描当前候选文件未发现已知本机密钥或常见 token / 私钥模式；邮箱命中均为保留的 Node 开源许可作者署名。零提交历史，无可清理历史。已知旧 Mac app 和 ZIP 内置密钥，已忽略保留本地；新打包脚本默认空密钥，旧包禁止上传。`.env`、凭据、依赖、缓存、构建、验证输出和发布包均排除 Git。

目前未忽略的候选内容约 0.98 GB；这不等于最终上传范围。包含一个 111.42 MiB 参考影片以及多个超过 50 MiB 的 WAV / 影片。先确认素材授权、LFS 规则与配额，保留全部本地原件。没有自动启用 LFS、迁移历史或推送到未知仓库。详情见 [GitHub 与大文件建议](GITHUB.md)、[保留与待确认项](PENDING.md)。

## 交付与复核入口

- [Windows 安装启动](WINDOWS.md)、[文件索引](FILES.md)、[素材清单](ASSETS.csv)、[视频清单](VIDEOS.csv)。
- 本地忽略的证据目录 `outputs/migration-20261018/`：完整文件 / 素材哈希 CSV、audit.json、secret 检查结果（仅路径）、preservation-check.json、测试日志、browser-smoke.json 和 desktop.png。
- 待用户给出明确 GitHub URL 与可见性后，再进行提交前复查、LFS 选择及上传；届时还需一次干净克隆和 Windows 实机验收。
