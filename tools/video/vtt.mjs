// Parsing is independent of the filesystem and of production/review status.
export const cleanCueEnding = text => text.replace(/(?<!\.)[，。,.](\s*)$/u, '$1');
const canonical = text => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
function seconds(stamp) {
  const match = /^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(stamp);
  if (!match) throw new Error('Invalid subtitle timestamp: ' + stamp);
  return (Number(match[1] ?? 0) * 60 + Number(match[2])) * 60 + Number(`${match[3]}.${match[4]}`);
}
export function parseVtt(text) {
  const blocks = canonical(text).split(/\n[ \t]*\n/);
  if (!/^WEBVTT(?:[ \t][^\n]*)?(?:\n|$)/.test(blocks[0])) throw new Error('Missing WEBVTT header');
  if (blocks[0].includes('-->')) throw new Error('Missing blank line after WEBVTT header');
  return blocks.slice(1).flatMap(block => {
    if (!block.trim()) return [];
    const lines = block.split('\n');
    if (/^(NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) return [];
    const at = lines.findIndex(line => line.includes('-->'));
    if (at < 0 || at > 1) throw new Error('Invalid subtitle block');
    const timing = /^(\S+)[ \t]+-->[ \t]+(\S+)(?:[ \t].*)?$/.exec(lines[at]);
    if (!timing) throw new Error('Invalid subtitle timing: ' + lines[at]);
    return [{ start: seconds(timing[1]), end: seconds(timing[2]), text: lines.slice(at + 1).join('\n').replace(/\n+$/, '') }];
  });
}
export function normalizeVtt(text) {
  parseVtt(text);
  return canonical(text).split(/\n[ \t]*\n/).map(block => {
    const lines = block.split('\n'), at = lines.findIndex(line => line.includes('-->'));
    if (at < 0 || /^(NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) return block;
    return [...lines.slice(0, at + 1), cleanCueEnding(lines.slice(at + 1).join('\n'))].join('\n');
  }).join('\n\n');
}
