/** 独立机制样例；尚未连接正式战场、存档或模型服务。 */
export type Facts = Record<string, boolean>;
export type Design = {
  version: string;
  mechanics: {
    crisis: { min: number; max: number; initial: number; base: number };
    formula: { id: string; certainBelow: number; probabilityAtThreshold: number; exponent: number };
    pressure: { perFailedRound: number; cap: number };
  };
  factDefinitions: Record<string, string>;
  branches: { id: string; name: string; group: string; reduction: number; all: string[] }[];
};
export type Evaluation = { crisis: number; probability: number; factors: { id: string; name: string; reduction: number }[] };
export type Resolution = {
  round: number; roundId: string; resolutionId: string; inputKey: string;
  crisis: number; probability: number; draw: number | null;
  outcome: 'safe' | 'holding' | 'unreachable'; pressureAfter: number;
  receiptIds: string[]; factors: Evaluation['factors'];
};
export type State = {
  schemaVersion: 1; designVersion: string; scenarioId: string;
  round: number; revision: number; pressure: number; rngState: number;
  status: 'holding' | 'safe'; journal: Resolution[];
};
export type RoundInput = {
  scenarioId: string; round: number; expectedRevision: number;
  trigger: 'endRound' | 'explicitWait'; commandBatchIds: string[];
  receiptIds: string[]; facts: Facts; contact: boolean; eligible?: boolean;
};

function integer(value: number, min: number, max: number, name: string) {
  if (!Number.isInteger(value) || value < min || value > max) throw Error(`Invalid ${name}`);
}
export function validateDesign(d: Design) {
  if (d.mechanics.crisis.min !== 0 || d.mechanics.crisis.max !== 99 || d.mechanics.crisis.base !== 99 || d.mechanics.crisis.initial !== 99) throw Error('Unsupported crisis scale');
  const f = d.mechanics.formula;
  if (f.id !== 'quadratic-v1' || f.certainBelow !== 10 || f.probabilityAtThreshold !== .99 || f.exponent !== 2) throw Error('Unsupported probability formula');
  integer(d.mechanics.pressure.perFailedRound, 0, 99, 'pressure step');
  integer(d.mechanics.pressure.cap, 0, 99, 'pressure cap');
  const ids = new Set<string>();
  for (const b of d.branches) {
    if (ids.has(b.id) || !b.id || !b.group || !b.all.length) throw Error('Invalid branch');
    ids.add(b.id); integer(b.reduction, 0, 99, 'reduction');
    if (b.all.some(k => !(k in d.factDefinitions))) throw Error('Unknown condition');
  }
}
export function escapeProbability(crisis: number): number {
  integer(crisis, 0, 99, 'crisis');
  return crisis < 10 ? 1 : .99 * ((99 - crisis) / 89) ** 2;
}
function validateFacts(d: Design, facts: Facts) {
  if (Object.keys(facts).length !== Object.keys(d.factDefinitions).length) throw Error('Incomplete or extra facts');
  for (const key of Object.keys(d.factDefinitions)) if (typeof facts[key] !== 'boolean') throw Error(`Missing boolean ${key}`);
}
export function evaluate(d: Design, facts: Facts, pressure = 0): Evaluation {
  validateDesign(d); validateFacts(d, facts);
  integer(pressure, 0, d.mechanics.pressure.cap, 'pressure');
  const groups = new Map<string, Design['branches'][number]>();
  for (const branch of d.branches) {
    if (!branch.all.every(k => facts[k])) continue;
    if ((groups.get(branch.group)?.reduction ?? -1) < branch.reduction) groups.set(branch.group, branch);
  }
  const factors = [...groups.values()].map(({ id, name, reduction }) => ({ id, name, reduction }));
  const crisis = Math.max(0, Math.min(99, d.mechanics.crisis.base + pressure - factors.reduce((sum, b) => sum + b.reduction, 0)));
  return { crisis, probability: escapeProbability(crisis), factors };
}
export function createState(d: Design, scenarioId: string, seed: number): State {
  validateDesign(d); integer(seed, 1, 0xffffffff, 'nonzero seed');
  if (!scenarioId.trim()) throw Error('Missing scenarioId');
  return { schemaVersion: 1, designVersion: d.version, scenarioId, round: 0, revision: 0, pressure: 0, rngState: seed, status: 'holding', journal: [] };
}
function random(state: number) {
  // 可复现游戏随机数。种子由宿主创建并保存，不由模型返回。
  let x = state >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return { state: x >>> 0, value: (x >>> 0) / 4294967296 };
}
function uniqueStrings(xs: string[]) {
  return Array.isArray(xs) && xs.every(x => typeof x === 'string' && !!x.trim()) && new Set(xs).size === xs.length;
}
/** 宿主必须先从真实账本投影facts，再原子保存返回state；不是可直接暴露给客户端的API。 */
export function resolveRound(d: Design, state: State, input: RoundInput): { state: State; resolution: Resolution; replayed: boolean } {
  validateDesign(d); validateFacts(d, input.facts);
  if (state.designVersion !== d.version || input.scenarioId !== state.scenarioId) throw Error('Scenario or design mismatch');
  integer(state.rngState, 1, 0xffffffff, 'rng state');
  if (!['endRound', 'explicitWait'].includes(input.trigger)) throw Error('Not a tactical round');
  if ((input.eligible !== undefined && typeof input.eligible !== 'boolean') || typeof input.contact !== 'boolean' || !uniqueStrings(input.receiptIds) || !uniqueStrings(input.commandBatchIds)) throw Error('Invalid receipt or batch identifiers');
  const inputKey = JSON.stringify({ ...input, commandBatchIds: [...input.commandBatchIds].sort(), receiptIds: [...input.receiptIds].sort(), facts: Object.fromEntries(Object.keys(input.facts).sort().map(k => [k, input.facts[k]])) });
  const previous = state.journal.find(r => r.round === input.round);
  if (previous) {
    if (previous.inputKey !== inputKey) throw Error('Round already resolved with different input');
    return { state: structuredClone(state), resolution: structuredClone(previous), replayed: true };
  }
  if (state.status === 'safe') throw Error('Already safe');
  if (input.expectedRevision !== state.revision || input.round !== state.round + 1) throw Error('Stale revision or nonconsecutive round');
  const value = evaluate(d, input.facts, state.pressure);
  const next = structuredClone(state);
  let draw: number | null = null;
  let outcome: Resolution['outcome'] = input.contact ? 'holding' : 'unreachable';
  if (input.contact && input.eligible !== false && value.probability > 0) {
    const sample = random(next.rngState); next.rngState = sample.state; draw = sample.value;
    if (draw < value.probability) outcome = 'safe';
  }
  if (outcome === 'safe') next.status = 'safe';
  else if (input.contact) next.pressure = Math.min(d.mechanics.pressure.cap, next.pressure + d.mechanics.pressure.perFailedRound);
  next.round = input.round; next.revision++;
  const roundId = `round-${input.round}`;
  const resolution: Resolution = {
    round: input.round, roundId, resolutionId: `${state.scenarioId}/fu/${roundId}`,
    inputKey, crisis: value.crisis, probability: input.contact && input.eligible !== false ? value.probability : 0,
    draw, outcome, pressureAfter: next.pressure, receiptIds: [...input.receiptIds], factors: value.factors
  };
  next.journal.push(resolution);
  return { state: next, resolution, replayed: false };
}

/** 与队伍界面对齐的只读视图。phase由宿主事务状态给出，UI不计算概率。 */
export function crisisView(d: Design, state: State, facts: Facts, contact: boolean, phase: 'planning' | 'resolving' | 'resolved' = 'planning') {
  const e = evaluate(d, facts, state.pressure);
  const last = state.journal.at(-1);
  const safe = state.status === 'safe';
  const value = safe ? 0 : e.crisis;
  return {
    schemaVersion: 1 as const, scenarioId: state.scenarioId, frontId: 'fu' as const,
    revision: state.revision, tacticalRoundId: `round-${phase === 'resolved' ? state.round : state.round + 1}`, phase,
    crisis: { value, delta: value - (last?.crisis ?? 99), reasons: safe ? ['傅肜已脱离险境，待归营'] : [...e.factors.map(f => `${f.name}：危机降低${f.reduction}`), ...(state.pressure ? [`持续受困：危机增加${state.pressure}`] : [])] },
    withdrawal: {
      probability: safe || !contact ? 0 : e.probability,
      eligible: !safe && contact && e.probability > 0,
      blockers: safe ? ['已经脱险，不再抽签'] : !contact ? ['暂时失联，不能确认撤离'] : e.crisis === 99 ? ['危机尚未降低'] : [],
      status: safe ? 'withdrawn' as const : contact && e.probability > 0 ? 'eligible' as const : 'holding' as const
    },
    lastResolution: last && { roundId: last.roundId, resolutionId: last.resolutionId, outcome: last.outcome, probability: last.probability, crisis: last.crisis }
  };
}
