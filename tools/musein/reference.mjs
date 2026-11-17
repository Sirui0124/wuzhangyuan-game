import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const team = '87172d74-5a9d-4ce7-ba59-739c10d9a6e0'; // SS; explicitly chosen by the user.

function main() {
  const { values } = parseArgs({ options: {
    prompt: { type: 'string' },
    'prompt-file': { type: 'string' },
    image: { type: 'string', multiple: true, default: [] },
    model: { type: 'string' },
    aspect: { type: 'string', default: '16:9' },
    resolution: { type: 'string', default: '2k' },
    quantity: { type: 'string', default: '1' },
    output: { type: 'string' },
    generate: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log(`Musein 中国站参考图（固定使用 SS 团队）
用法：node tools/musein/reference.mjs --prompt-file <UTF-8文件> [选项]
  --prompt <文字>        与 --prompt-file 二选一；不会附加风格提示词
  --image <路径或URL>    可重复；也支持 task:<任务ID>
  --model <模型ID>       默认 Seedream 4.5；有参考图时自动使用 edit 版本
  --aspect <比例>        默认 16:9
  --resolution <分辨率>  默认 2k
  --quantity <1..9>      默认 1
  --output <目录>        默认 outputs/musein/<时间戳>
  --generate            提交并等待下载；省略时只试算积分
凭据由 Musein CLI 从用户目录读取；不自动重试提交。`);
    return;
  }
  if (Boolean(values.prompt) === Boolean(values['prompt-file'])) {
    throw new Error('请通过 --prompt 或 --prompt-file 提供一份提示词。');
  }
  const prompt = (values['prompt-file']
    ? readFileSync(resolve(values['prompt-file']), 'utf8')
    : values.prompt).replace(/^\uFEFF/, '').trim();
  if (!prompt) throw new Error('提示词不能为空。');
  if (!/^[1-9]$/.test(values.quantity)) throw new Error('quantity 必须是 1..9。');
  if (!['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'].includes(values.aspect)) {
    throw new Error('不支持的 aspect；请使用 16:9、9:16、1:1、4:3、3:4、3:2 或 2:3。');
  }
  if (!['1k', '2k', '4k'].includes(values.resolution)) throw new Error('resolution 必须是 1k、2k 或 4k。');
  const images = values.image.map(value => {
    if (/^(https:\/\/|task:)/.test(value)) return value;
    const local = resolve(value);
    if (!existsSync(local)) throw new Error(`参考图不存在：${local}`);
    return local;
  });
  const model = values.model || `bytedance/seedream-v4.5${images.length ? '/edit' : ''}`;
  const output = resolve(values.output || join(root, 'outputs/musein', new Date().toISOString().replace(/[:.]/g, '-')));
  const bundledExe = process.platform === 'win32' && process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, 'Programs/Musein/bin/musein.exe') : null;
  const executable = bundledExe && existsSync(bundledExe) ? bundledExe : 'musein';
  const args = ['gen', '--type', 'image', '--endpoint', 'cn', '--team', team,
    '--model', model, '--strict-model', '--prompt', prompt,
    '--quantity', values.quantity, '--param', `aspect_ratio=${values.aspect}`,
    '--param', `resolution=${values.resolution}`, '--json'];
  for (const image of images) args.push('--image', image);
  if (values.generate) {
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, 'request.json'), JSON.stringify({
      created_at: new Date().toISOString(), endpoint: 'cn', team_id: team,
      model, prompt, images, aspect_ratio: values.aspect,
      resolution: values.resolution, quantity: Number(values.quantity),
    }, null, 2) + '\n');
    args.push('--wait=600s', '--output', output);
  } else {
    args.push('--dry-run');
  }
  console.error(`Musein CN · SS · ${model} · ${values.generate ? '生成' : '仅试算'}`);
  const result = spawnSync(executable, args, {
    encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stdout.write(result.stdout);
  if (values.generate) {
    writeFileSync(join(output, 'result.json'), result.stdout || '{}\n');
    console.error(`记录与图片目录：${output}`);
  }
  if (result.status === 9) console.error('提交结果未知：请用 musein task resolve 核查，不要重新提交。');
  if (result.status === 4) console.error('SS 团队积分不足；补充积分后再生成。');
  process.exitCode = result.status ?? 1;
}

try { main(); } catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
