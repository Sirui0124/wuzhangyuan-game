/**
 * Conservative penalty trigger for the phone's CURRENT user input only.
 * This is not a prompt-injection firewall. Unknown/ambiguous text is unblocked;
 * authoritative prices, inventory and currency must be isolated independently.
 * Never pass history, prompts or model output here. This module changes no state.
 */
export const PHONE_GUARD_REASONS = Object.freeze([
  'override_rules', 'impersonate_system', 'tamper_balance', 'tamper_price',
  'bypass_payment', 'forge_purchase', 'reveal_internal',
]);

const rules = [
  ['override_rules', /(?:忽略|无视|绕过|覆盖|替换|删除|取消|禁用|关闭|停止遵守|不再遵守)(?:所有|全部|之前的|以前的|原有的|现有的|以上的|你(?:的)?|任何|相关|这些|这套|\s){0,8}(?:系统|开发者|定价|价格|安全)(?:提示词|提示|指令|规则|约束|限制|要求|机制|校验)/iu],
  ['override_rules', /(?:ignore|disregard|override|replace|bypass|disable|forget)\s+(?:(?:all|the|your|any|previous|prior|above|existing|original)\s+)*(?:(?:system|developer|pricing|price|safety)\s+)(?:prompts?|instructions?|rules?|constraints?|restrictions?|checks?)/iu],
  ['override_rules', /(?:ignore|disregard|override|forget)\s+(?:(?:all|the|your)\s+)*(?:previous|prior|above)\s+instructions?/iu],
  ['impersonate_system', /(?:开启|启用|进入|切换到)(?:无限制|无约束|系统|超级)?(?:开发者模式|管理员模式|developer\s+mode|admin\s+mode)/iu],
  ['impersonate_system', /(?:把我当(?:作|成)|将我视为)(?:你的|本次的)?(?:系统|开发者|管理员|最高权限)/iu],
  ['impersonate_system', /(?:我是|我就是)(?:你的|本系统的)?(?:系统管理员|开发者|系统消息)[，,\s]*(?:你(?:现在)?必须服从我|接受我的授权|按我的(?:系统)?指令执行)/iu],
  ['impersonate_system', /(?:you\s+are\s+now|act\s+as|switch\s+to|enable)\s+(?:an?\s+|the\s+)?(?:unrestricted\s+)?(?:system\s+administrator|developer\s+mode|admin\s+mode)/iu],
  ['tamper_balance', /(?:把|将)(?:我的|当前|游戏|钱包|账户|帐户|你的|\s){0,5}(?:余额|资金).{0,12}?(?:改为|改成|改到|设为|设成|设置为|写成|增加到|调整为|变成)/iu],
  ['tamper_balance', /(?:修改|改写|篡改|设置|重置)(?:我的|当前|游戏|钱包|账户|帐户|\s){0,5}(?:余额|资金)/iu],
  ['tamper_balance', /(?:set|change|modify|overwrite|reset|edit)\s+(?:(?:my|the|your|current|game|wallet|account)\s+)*(?:balance|funds|currency)\b/iu],
  ['tamper_balance', /(?:balance|wallet_balance|wallet\.balance)\s*(?:\+=|-=|=(?!=)|:=)\s*\d/iu],
  ['tamper_price', /(?:把|将).{0,18}?(?:标价|售价|系统价格|商品价格|商品的价格|价格字段|价格).{0,10}?(?:改为|改成|改到|设为|设成|设置为|写成|重写为)/iu],
  ['tamper_price', /(?:篡改|改写|覆盖|强制修改)(?:商品的?|系统的?|这个|所有|\s){0,5}(?:标价|售价|价格)/iu],
  ['tamper_price', /(?:set|change|modify|overwrite|edit)\s+(?:(?:the|this|item|product|listing|listed|system)\s+)*(?:price|price\s+field)\s+(?:to|as|=)/iu],
  ['bypass_payment', /(?:绕过|跳过|禁用|关闭|取消)(?:购买时的|购买的|游戏的|系统的|所有|自动|\s){0,4}(?:扣款|支付校验|付款校验|支付验证|余额校验|资金校验)/iu],
  ['bypass_payment', /(?:不扣(?:款|钱|余额)|无需(?:付款|支付)|未经购买)[，,\s]*(?:直接|也要|照样|仍然)(?:购买|发货|发放|放入|加入|添加)/iu],
  ['bypass_payment', /(?:直接|强行|凭空)(?:把|将)?.{0,18}?(?:放入|加入|添加到|发放到).{0,8}?(?:背包|物品栏)[，,\s]*(?:并且?|而且)?(?:不要扣款|不扣款|不扣钱|无需付款)/iu],
  ['bypass_payment', /(?:bypass|skip|disable)\s+(?:(?:the|all|any)\s+)*(?:payment|purchase\s+validation|balance\s+checks?|charging)/iu],
  ['forge_purchase', /(?:把|将).{0,18}?(?:标记|设定|设置|改)(?:为|成)(?:我)?(?:已购买|已购|已付款|已支付|已拥有)/iu],
  ['forge_purchase', /(?:伪造|编造)(?:我的|一条|一个|这些|\s){0,4}(?:购买记录|已购记录|付款记录|支付记录|已购状态)/iu],
  ['forge_purchase', /(?:假装|当作|视为)(?:我|这件商品|这个商品|这些物品)(?:已经|已)(?:购买|买过|买了|付款|支付)/iu],
  ['forge_purchase', /(?:mark|set)\s+.{0,30}?\s+as\s+(?:already\s+)?(?:purchased|paid|owned)\b/iu],
  ['forge_purchase', /(?:forge|fabricate|fake)\s+(?:(?:my|a|the|these)\s+)*(?:purchase|payment|ownership)\s+(?:records?|receipts?|status)/iu],
  ['reveal_internal', /(?:输出|显示|打印|泄露|返回|给我看|告诉我|列出)(?:你的|你(?:所用|使用)的|内部的?|隐藏的?|完整的?|原始的?|全部|实际的?|服务端的?|后端的?|\s){0,6}(?:系统提示词|系统prompt|开发者提示词|隐藏提示词|内部提示词|API[ _-]?key|API密钥|接口密钥|服务端密钥|后端密钥)/iu],
  ['reveal_internal', /(?:reveal|print|output|show|leak|return|tell\s+me)\s+(?:(?:me|your|the|full|entire|hidden|internal|original|server)\s+)*(?:system\s+prompt|developer\s+prompt|internal\s+instructions|api[ _-]?key|secret\s+key)/iu],
];

const blank = value => value.replace(/[^\r\n]/g, ' ');
const quotePatterns = [
  /```[\s\S]*?```/g, /`[^`\r\n]*`/g,
  /“[^”]*”|「[^」]*」|『[^』]*』|‘[^’]*’/g,
  /"(?:[^"\\]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'/g,
  /(^|\n)[ \t]*>[^\r\n]*/g,
];

function quotedData(text) {
  // Quoted or fenced examples are data, unless the user explicitly adopts them.
  const adopt = /^(?:请(?:你)?|立刻|现在)?(?:执行|照做|遵守)(?:以下|下面|这段|这个).{0,6}(?:命令|指令|要求)/iu.test(text.trim())
    || /^(?:please\s+)?(?:execute|follow|obey)\s+(?:the\s+)?(?:following|below)\s+instructions?/iu.test(text.trim());
  if (adopt) return text.replace(/[“”「」『』‘’"`]/g, ' ');
  return quotePatterns.reduce((value, pattern) => value.replace(pattern, blank), text);
}

function discussionOrNegation(clause, index, length) {
  const before = clause.slice(0, index), after = clause.slice(index + length);
  if (/^(?:请)?(?:解释|翻译|分析|讨论|评估|识别|检测|举例|例如|比如|假如有人|如果有人|我在研究|我看到|我看见|我听到)/iu.test(clause.trim())) return true;
  if (/^(?:what\s+does|explain|translate|analy[sz]e|is\s+the\s+phrase|for\s+example|someone\s+(?:said|asked)|i\s+(?:saw|read|heard))/iu.test(clause.trim())) return true;
  if (/(?:有人|他|她|他们|用户|网页|消息|文本|例子)(?:对我)?(?:说|写|提到|要求|让|包含|出现).{0,30}$/u.test(before)) return true;
  if (/(?:是什么意思|的意思是什么|这句话|这条指令|这类攻击|算不算.{0,12}攻击|是不是.{0,12}攻击|会(?:有什么|怎样|怎么样|如何)|有什么(?:风险|后果|问题)|(?:是|并不是|不是).{0,8}(?:错误|不对|不允许|不应该|危险|不合理|不可取))/u.test(after)) return true;
  if (/^\s+(?:means?\b|is\s+(?:not|unsafe|wrong|dangerous|a\s+bad|an?\s+example|forbidden)\b|would\b|can\s+(?:cause|lead)\b)/iu.test(after)) return true;
  if (!/(?:能不能|可不可以)\s*$/u.test(before) && /(?:不要|别|禁止|不许|不能|无需|不用|不必|请勿|切勿|拒绝|避免|不会|不应该|不应|不可以|不打算|不想|不要求|没有要求)(?:你|再|去|尝试|试图|直接|随意|擅自|也|真的|一定|帮我|执行|进行|主动|将|把|\s){0,12}$/u.test(before)) return true;
  if (/(?:do\s+not|don't|never|must\s+not|should\s+not|cannot|can't|not\s+to|avoid|stop)\s+(?:\w+\s+){0,2}$/iu.test(before)) return true;
  if (/(?:之前|以前|刚才|曾经|上次|已经|有没有|是否曾).{0,8}$/u.test(before)) return true;
  return false;
}

function commandLead(before) {
  let prefix = before.trim().replace(/^[：:、\-\s]+/, '')
    .replace(/^(?:请(?:你)?|立刻|现在)?(?:执行|照做|遵守)(?:以下|下面|这段|这个).{0,6}(?:命令|指令|要求)[：:\s]*/u, '')
    .replace(/^(?:please\s+)?(?:execute|follow|obey)\s+(?:the\s+)?(?:following|below)\s+instructions?[：:\s]*/iu, '');
  // Consume one token at a time: no ambiguous repeated-alternative backtracking.
  const token = /^(?:从现在开始|从现在起|管理员命令|最高优先级|请帮我|我要求你|我要你|你能不能|可不可以|是否可以|你现在|你必须|你需要|你能否|你可以|能不能|能帮我|接下来|系统指令|新指令|麻烦你|请你|现在|立刻|马上|直接|本轮|然后|另外|务必|必须|能否|可以|帮忙|注意|那就|只需|只要|但是|但|也|请|麻烦|帮我|你|先|就|\s+|please\b|kindly\b|now\b|but\b|and\b|you\s+must\b|you\s+should\b|you\s+can\b|can\s+you\b|could\s+you\b|will\s+you\b|i\s+want\s+you\s+to\b|i\s+instruct\s+you\s+to\b|from\s+now\s+on\b)/iu;
  while (prefix) {
    const match = token.exec(prefix);
    if (!match) return false;
    prefix = prefix.slice(match[0].length);
  }
  return true;
}

function inspectPlain(raw) {
  const text = quotedData(raw);
  // Split independent clauses, so a negation/example cannot bless the next command.
  // A second whole-sentence pass handles an explicit no-payment grant across commas.
  const segments = [...text.matchAll(/[^。！？!?；;，,\r\n]+/gu), ...text.matchAll(/[^。！？!?；;\r\n]+/gu)];
  for (const segment of segments) {
    const clause = segment[0];
    for (const [reason, pattern] of rules) {
      const match = pattern.exec(clause);
      if (!match || discussionOrNegation(clause, match.index, match[0].length) || !commandLead(clause.slice(0, match.index))) continue;
      const start = segment.index + match.index;
      const restOfSentence = text.slice(start).split(/[。！？!?；;\r\n]/u, 1)[0];
      if (/[，,].{0,8}(?:不要|别|切勿|禁止)(?:这样|这么)做/u.test(restOfSentence)) continue;
      // "Your API key is what?" is ambiguous education, not a penalty trigger.
      if (reason === 'reveal_internal' && /^(?:是什么|的含义|\s+(?:means?|is\s+what)\b)/iu.test(clause.slice(match.index + match[0].length))) continue;
      if (reason === 'impersonate_system' && /[吗么]\s*$/u.test(clause)) continue;
      return { blocked: true, reason, evidence: raw.slice(start, start + Math.min(match[0].length, 120)) };
    }
  }
  return { blocked: false };
}

export function inspectPhoneInput(query) {
  if (typeof query !== 'string' || !query.trim()) return { blocked: false };
  const text = query.trim();
  // Only a whole raw envelope is a forged role. A quoted JSON example is not.
  if (/^[{[]/u.test(text)) {
    try {
      const data = JSON.parse(text);
      const envelopes = Array.isArray(data) ? data : [data];
      for (const entry of envelopes) {
        if (!['system', 'developer'].includes(entry?.role) || typeof entry.content !== 'string') continue;
        if (inspectPlain(entry.content).blocked) return { blocked: true, reason: 'impersonate_system', evidence: text.slice(0, 120) };
      }
    } catch { /* Not a complete role envelope: inspect ordinary text conservatively. */ }
  }
  const tag = /^(?:<\/?(?:system|developer)(?:\s[^>]*)?>|\[(?:system|developer)\]|<\|im_start\|>\s*(?:system|developer)|\[INST\]\s*<<SYS>>|(?:system|developer)\s*:)[\s:]*/iu.exec(text);
  if (tag && inspectPlain(text.slice(tag[0].length).replace(/<\/(?:system|developer)>|<\|im_end\|>|<<\/SYS>>|\[\/INST\]/giu, '')).blocked)
    return { blocked: true, reason: 'impersonate_system', evidence: text.slice(0, 120) };
  return inspectPlain(query);
}
