# GitHub 管理与上传边界

> 2026-10-18 后续授权：用户要求直接上传至个人 GitHub 并设为 private。已创建并核对私有仓库 `Sirui0124/wuzhangyuan-game`。本次启用 MP4 / MOV / WEBM / WAV / MP3 / PNG / PSD / AEP 的 Git LFS 规则，上传代码与未忽略素材。下文保留首次本地整理阶段的审计记录；其中“尚未启用 / 尚未上传”为该阶段状态。最新上传验收见 `UPLOAD.md`。

本次仅本地整理；没有添加远程、提交、暂存或推送。原 `GameStarter/.git` 是无提交、无对象、无远程的空仓库，现移至根目录，以覆盖 `content`、`source-art`、`video` 等真实依赖。原位置及全部文件均已在外部检查点保存。

## 排除与敏感信息

根 `.gitignore` 排除 `.env` 及其变体（保留 `.env.example`）、凭据文件、`api-defaults.json`、私钥、`node_modules`、Cocos 缓存、网页构建、验证输出和 `releases/`。不要使用 `git add -f` 绕过这些规则。完整本地迁移可以另行带走私有环境文件；GitHub 代码交付只带空白示例，接收者自行配置。

扫描覆盖当前文本文件的常见 API token / 私钥 / 签名 URL / JWT / 账号字段 / 邮箱与手机号模式，并用本机已知密钥做全文件及 ZIP 解包匹配。Git 历史为零提交，暂无历史需要清洗。待上传文本发现的邮箱仅为 Node 开源许可证作者署名，应保留版权。扫描并非对未知凭据或二进制个人信息的完整证明，首次提交前仍须复查新增内容。

旧 Mac `.app` 内的 `api-defaults.json` 及旧 ZIP 曾内置本机密钥，现仅留在忽略的本地发布目录和外部私有检查点。**不要把旧安装包或完整检查点作为 GitHub Release 上传。** 新打包脚本默认密钥为空；本次没有重新生成或验证 Mac 安装包。如果旧包曾流出，需在服务商处轮换该密钥。

## 大文件与 LFS

GitHub 普通 Git 对超过 50 MiB 的文件提出警告，超过 100 MiB 的单文件阻止上传；官方建议仓库尽量小于 1 GB。见 [GitHub 大文件限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)。当前未忽略候选接近 1 GB，包含一个超过 100 MiB 的参考影片，不能直接全量普通 Git 提交。

| 素材 | 约大小 | 建议 |
| --- | ---: | --- |
| `source-art/video-style-study-20261016/originals/helong.mp4` | 111.42 MiB | 确认来源授权；选择 LFS 或本地外部素材库 |
| 同目录 `beihai.mp4` | 61.66 MiB | 同上 |
| `source-art/五丈原_BGM接入_v01/prepared/home.wav` | 66.32 MiB | LFS；保留原件 |
| `GameStarter/web-demo/public/audio/bgm/home.wav` | 66.32 MiB | LFS；当前运行依赖 |
| 其余视频、WAV 和源工程 | 详见 ASSETS / VIDEOS 清单 | 优先 LFS，兼顾来源、版本管理价值与配额 |
| `outputs/`、`releases/` | 含大录屏、旧运行时和 ZIP | 已忽略，不进入代码仓库 |

建议获知仓库 URL、可见性和素材交付选择后，再安装 Git LFS、执行 `git lfs install`，为 `*.mp4`、`*.mov`、`*.webm`、`*.wav`、`*.psd`、`*.aep` 等选定规则。较大的 PNG 可按清单逐项选择，`.meta`、代码与文本保持普通 Git。**本次没有启用 LFS 规则或改写媒体文件。** LFS 在 Git 中保存指针，媒体由 LFS 存储分发，迁移电脑也需安装 LFS 并下载原件；预算和下载配额需结合目标账号确认。见 [Git LFS 官方说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage)。

## 得到明确仓库信息后的顺序

1. 核对准确 URL、仓库可见性、素材授权及 LFS 配额。
2. 确定参考影片等素材采用 LFS、外部素材库或保持本地；若移出，更新来源文档，保持运行依赖完整。
3. 重新运行审计、构建、资源核对；检查 `.env` 等仍被忽略，人工检查实际待暂存列表与 diff。
4. 提交源代码、锁文件、文档、空白环境示例、选定素材及 LFS 属性，再配置已确认的远程上传。
5. 在干净目录克隆、拉取 LFS、`npm ci`、构建和 Windows 启动，核对原件 SHA-256。
