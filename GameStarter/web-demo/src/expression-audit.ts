import { ExpressionSafetyError } from './npc-dialogue';
import type { ExpressionBrief } from './expression-contract';

export type ExpressionAuditTargets = {
    intent: { id: string; text: string }[];
    meanings: { id: string; evidenceId: string; text: string }[];
};
/** Split only the supplied material; this adds no facts or gameplay requirements. */
export function expressionAuditTargets(brief: ExpressionBrief): ExpressionAuditTargets {
    const parts = (text: string) => text.split(/[，,；;。！？!?\n]+/).map(s => s.trim()).filter(Boolean);
    const sources = brief.playerIntent.draft !== undefined || brief.playerIntent.focus !== undefined
        ? [['draft', brief.playerIntent.draft ?? ''], ['focus', brief.playerIntent.focus ?? '']]
        : [['words', brief.playerIntent.words]];
    return {
        intent: sources.flatMap(([field, text]) => parts(text).map((text, i) => ({ id: `${field}:${i}`, text }))),
        meanings: brief.selectedEvidence.flatMap(item => parts(item.meaning).map((text, i) => ({ id: `${item.id}:${i}`, evidenceId: item.id, text }))),
    };
}

const labels = { intent: '改变了你的表达意思', actors: '人物关系不一致', facts: '加入了缺少依据的内容', coverage: '遗漏了选中的线索' } as const;
export type ExpressionDiagnostic = { kind: 'content' | 'format'; issues: string[]; reason: string; candidate: string };
export class ExpressionInputConflictError extends ExpressionSafetyError {
    constructor() { super('补充说明与准备说的话有不一致之处，本次未替换原稿。请先改好其中一处。'); }
}
export class ExpressionAuditError extends ExpressionSafetyError {
    constructor(public readonly diagnostic: ExpressionDiagnostic) {
        super(diagnostic.kind === 'format' ? '润色服务返回格式异常，本次新稿未采用。'
            : `新稿${diagnostic.issues.map(key => labels[key as keyof typeof labels]).join('、')}，自动修正后仍未完成。`);
    }
}

/** Separate semantic rejection from broken/inconsistent audit responses. Never expose raw model text in UI. */
export function checkExpressionAudit(value: unknown, candidate: string, requireInputConflictCheck = false, targets?: ExpressionAuditTargets): void {
    const a = value as { checks?: Record<string, unknown>; supported?: unknown; reason?: unknown; inputConflict?: unknown; intentComparison?: unknown; meaningMatches?: unknown } | null;
    const keys = Object.keys(labels), valid = !!a && typeof a === 'object' && a.checks
        && keys.every(key => typeof a.checks![key] === 'boolean');
    const issues = valid ? keys.filter(key => a!.checks![key] === false) : [];
    // The four checks are authoritative; do not require duplicate approval or prose on success.
    // A legacy explicit veto with all-positive checks is ambiguous, so request a fresh audit.
    if (!valid || (requireInputConflictCheck && typeof a!.inputConflict !== 'boolean') || (!issues.length && a!.supported === false)) throw new ExpressionAuditError({
        kind: 'format', issues: [], reason: '审核结果缺少有效字段，或分项与总体结论不一致。', candidate,
    });
    if (requireInputConflictCheck && a!.inputConflict === true) throw new ExpressionInputConflictError();
    if (targets) {
        const missing: string[] = [];
        const validMatches = (raw: unknown, wanted: { id: string }[], kind: 'intent' | 'coverage') => {
            if (!Array.isArray(raw) || raw.length !== wanted.length || new Set(raw.map(row => row?.id)).size !== wanted.length) return false;
            return raw.every(row => {
                if (!row || !wanted.some(target => target.id === row.id) || typeof row.quote !== 'string'
                    || (row.quote !== '' && (!row.quote.trim() || !candidate.includes(row.quote)))) return false;
                if (kind === 'intent' && (typeof row.styleOnly !== 'boolean' || (row.styleOnly && row.quote !== ''))) return false;
                // Empty substantive matches are a content repair, not malformed transport.
                if (a!.checks![kind] === true && !row.quote && !(kind === 'intent' && row.styleOnly === true)) missing.push(kind);
                return true;
            });
        };
        if (!validMatches(a!.intentComparison, targets.intent, 'intent') || !validMatches(a!.meaningMatches, targets.meanings, 'coverage'))
            throw new ExpressionAuditError({ kind: 'format', issues: [], reason: '审核未逐项引用原意或线索的对应台词，或引文与分项结论不一致。', candidate });
        if (missing.length) throw new ExpressionAuditError({ kind: 'content', issues: [...new Set(missing)],
            reason: '审核记录中有原意或所选含义找不到对应台词；保留原输入，补回遗漏含义，不能改换玩家的办法。', candidate });
    }
    if (issues.length) throw new ExpressionAuditError({ kind: 'content', issues,
        reason: typeof a!.reason === 'string' && a!.reason.trim() ? a!.reason.trim().slice(0, 240)
            : issues.map(key => labels[key as keyof typeof labels]).join('；'), candidate });
}
