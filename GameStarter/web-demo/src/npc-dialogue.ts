/** Stable AI wire format. Chapter routing stays in ChapterSession. */
export const persuasionCodes = ['ok', 'execute', 'R1-RETRY', 'P2-F1', 'P2-F2', 'P2-F2B', 'P2-F3', 'P2-F4', 'P2-F5'] as const;
export type PersuasionResult = typeof persuasionCodes[number];
export type DialogueStage = 'first' | 'authorized';
export type NpcTurn = {
    schemaVersion: 1;
    npcId: 'weiyan';
    stage: DialogueStage;
    classification: { code: PersuasionResult; disposition: 'accept' | 'revise' | 'execute'; reason: string; evidenceIds: string[] };
    reply: { speaker: '魏延'; text: string };
};
export const npcTurnShape = { schemaVersion: 1, npcId: 'weiyan', stage: 'first或authorized', classification: { code: '本阶段允许的结果码', disposition: 'accept或revise或execute', reason: '简短可核验的判断理由，不写思维过程', evidenceIds: ['实际引用的已得依据编号'] }, reply: { speaker: '魏延', text: '一至两句、最多45字的回应' } };
export function validCode(code: unknown, stage: DialogueStage): code is PersuasionResult {
    return stage === 'first' ? code === 'ok' || code === 'execute' || code === 'R1-RETRY' : persuasionCodes.includes(code as PersuasionResult) && code !== 'R1-RETRY';
}
export const classificationReasons: Record<PersuasionResult, string> = {
    ok: '本次已说内容满足当前交涉条件。', execute: '本次发言完全无关军情交涉，或直接冒犯魏延。', 'R1-RETRY': '尚未说清军情、禁令或立即转呈的方案。',
    'P2-F1': '有无依据的断言，或尚未说明姜维本人的接报承诺。', 'P2-F2': '提出压报或拖延军情。',
    'P2-F2B': '仍主张强行入帐。', 'P2-F3': '表达包含辱骂或威胁。',
    'P2-F4': '尚未说清敌军前后反应、随军换向及可能试探的判断。', 'P2-F5': '尚未说明不入帐、立即当面交报的安排。',
};
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function prose(value: unknown, max: number): value is string {
    return typeof value === 'string' && !!value.trim() && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
export function parseNpcTurn(value: unknown, stage: DialogueStage, evidenceIds: string[]): NpcTurn {
    if (!exact(value, ['schemaVersion', 'npcId', 'stage', 'classification', 'reply']) || value.schemaVersion !== 1 || value.npcId !== 'weiyan' || value.stage !== stage
        || !exact(value.classification, ['code', 'disposition', 'reason', 'evidenceIds']) || !exact(value.reply, ['speaker', 'text'])) throw new Error('NPC回应结构不兼容');
    const c = value.classification, reply = value.reply;
    if (!validCode(c.code, stage) || c.disposition !== (c.code === 'ok' ? 'accept' : c.code === 'execute' ? 'execute' : 'revise') || !prose(c.reason, 240)
        || !Array.isArray(c.evidenceIds) || c.evidenceIds.length > 20 || new Set(c.evidenceIds).size !== c.evidenceIds.length || c.evidenceIds.some(id => typeof id !== 'string' || !evidenceIds.includes(id))
        || reply.speaker !== '魏延' || !prose(reply.text, 300) || /```|P2-F\d|R1-RETRY|schemaVersion|evidenceIds/.test(reply.text)) throw new Error('NPC回应字段不兼容');
    return value as NpcTurn;
}

export class ExpressionSafetyError extends Error {
    constructor(message: string) { super(message); this.name = 'ExpressionSafetyError'; }
}
