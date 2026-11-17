# Musein 参考图调用

从工作区根目录运行，Node.js 22+，使用已登录的 Musein CLI。中国站固定为 `cn`，每次显式指定用户选定的 **SS 团队**。凭据仍由 CLI 存放在用户目录 `~/.musein`，此工具不读取或复制密钥。

## 调用

将已确认的提示词保存为 UTF-8 文件（例如 `outputs/musein/prompt.txt`），先试算：

```powershell
node tools/musein/reference.mjs --prompt-file outputs/musein/prompt.txt
```

确认参数后生成、等待并下载：

```powershell
node tools/musein/reference.mjs --prompt-file outputs/musein/prompt.txt --generate
```

使用参考图（可重复 `--image`，支持本机文件、HTTPS URL、`task:<任务ID>`）：

```powershell
node tools/musein/reference.mjs --prompt-file outputs/musein/prompt.txt --image source-art/visuals/style-tests/20261019-new-direction/user-atmosphere-reference.png
```

上述命令只试算；加 `--generate` 才生成。CLI 可能为本机参考图进行上传，即使只试算也会把该参考图交给 Musein。

默认文生图为 `bytedance/seedream-v4.5`；提供参考图时自动改为 `bytedance/seedream-v4.5/edit`。默认 16:9、2K、1 张。模型由当前接口参数验证选定，不表示已经完成出图质量比较。不会自动附加或改写提示词；项目风格以 `docs/visual-direction/原始参考关键词与第一视角适配.md` 及当前任务要求为准。

使用 `--model <模型ID>` 可换模型，`--aspect 1:1 --resolution 2k --quantity 1` 可改参数。工具传入的画幅和分辨率选项按 Seedream 4.5 验证；其他模型请先查看参数，必要时直接调用 CLI。

```powershell
musein models --type image --endpoint cn --refresh-models --json
musein models show 'bytedance/seedream-v4.5/edit' --endpoint cn --json
```

## 输出和恢复

实际生成的结果默认保存在 `outputs/musein/<时间戳>/`，包括 `request.json`、CLI 原始返回 `result.json` 和下载图片；该目录已由工作区 `.gitignore` 排除。可用 `--output <目录>` 指定独立输出位置。正式采用的图片再归档到 `source-art`，接入游戏另行执行。

超时或中断后读取原任务，避免再次生成和扣费：

```powershell
musein task get <任务ID> --endpoint cn --wait=600s --output outputs/musein/recovered --json
```

退出码 9 表示提交结果未知，先执行 `musein task resolve <任务ID或client_request_id> --endpoint cn --json`。工具不自动重试提交；退出码 4 表示积分不足。

CLI 0.1.2 不能直接读写 Musein 画布。此入口生成并下载参考图，画布排版或导入需要另行操作。

## 验证记录（2026-10-20）

- 中国站登录成功；SS 团队已设为 CLI 默认扣费团队。
- 文生图和图生图的模型详情、试算请求均通过。Seedream 4.5 这组 16:9、2K、1 张请求分别报价 7 / 8 积分，实际以提交时试算及最终扣费为准。
- `whoami` 的余额字段仍是个人钱包；不能据此判断 SS 团队余额，团队额度由服务端在生成时检查。
- 本次未提交付费生成，图片质量、等待和下载链路尚未实测。
