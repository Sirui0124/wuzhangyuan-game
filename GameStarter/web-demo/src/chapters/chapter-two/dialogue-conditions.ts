import type { Rubric, Dimension, Judgment } from './dialogue-judgment';
import { dialogueProtocolError } from './dialogue-errors';

export const finalAssessmentVersion = 'gouan-final-assessment-v1';
type Condition = { id: string; dimension: Dimension; level: number; sourceClause: string; meaning: string; needsWords: boolean };
type Level = { rubricText: string; alternatives: string[][] };
export type NecessaryConditions = { version: typeof finalAssessmentVersion; rubricVersion: string; round: 'O1' | 'O2'; variant: 'current-round' | 'legacy-open1'; items: Condition[]; levels: Partial<Record<Dimension, Record<string, Level>>> };
/** Decomposition of the reviewed rubric, never a replacement scale. Each clause retains its exact source. */
export function necessaryConditionsFor(rubric: Rubric): NecessaryConditions {
    const legacy = rubric.scene === undefined && rubric.rounds === undefined;
    if (rubric.version !== 'gouan-open1-20261025-review2' || (!legacy && !['O1', 'O2'].includes(rubric.scene ?? '')))
        dialogueProtocolError('condition-rubric-version-unknown', 'rubric.version');
    const round = rubric.scene ?? 'O1', items: Condition[] = [], levels: NecessaryConditions['levels'] = {};
    function level(dimension: Dimension, value: number, rubricText: string, clauses: [string, string, string, boolean][], alternatives?: string[][]) {
        if (rubric.dimensions[dimension].levels[String(value)] !== rubricText)
            dialogueProtocolError('condition-rubric-text-changed', `rubric.dimensions.${dimension}.levels.${value}`);
        const ids = clauses.map(([name, sourceClause, meaning, needsWords]) => {
            if (!rubricText.includes(sourceClause)) throw new Error('Condition source is not part of the reviewed rubric');
            const id = `${round}.${dimension}.${value}.${name}`;
            items.push({ id, dimension, level: value, sourceClause, meaning, needsWords }); return id;
        });
        (levels[dimension] ??= {})[String(value)] = { rubricText, alternatives: alternatives
            ? alternatives.map(group => group.map(name => `${round}.${dimension}.${value}.${name}`)) : [ids] };
    }
    if (legacy) {
        level('trust', 2, '理解他的委屈或处境，并承诺具体核查、把结果如实带回，使他有理由暂时信任我。', [
            ['understanding', '理解他的委屈或处境', '本次话语体现对苟安处境的理解；自然反证说明委屈也可成立。', true],
            ['checking', '承诺具体核查', '玩家本人承诺具体核查，不能把命令别人去查当本人承诺。', true],
            ['truthful_return', '把结果如实带回', '玩家本人承诺如实带回结果，允许明确的同义或含蓄表达。', true],
        ]);
        level('rigor', 2, '准确使用五月饮酒、六月领粮等已知事实指出解释缺口，并提出核验；不越界断言阴谋。', [
            ['factual_gap', '准确使用五月饮酒、六月领粮等已知事实指出解释缺口', '本次话语用真实已知事实指出解释缺口。', true],
            ['verification', '并提出核验', '旧专项入口原规则另需提出核验，不能按正式O1较新的尺度省略。', true],
            ['no_plot_assertion', '不越界断言阴谋', '没有越界断言阴谋；未作这种断言即可。', false],
        ]);
        level('responsibility', 2, '具体核验后如实上报；或明确自己查清委屈，同时不隐瞒苟安真实过错。', [
            ['check_report', '具体核验后如实上报', '玩家本人具体核验后如实上报，不能把主体换成他人。', true],
            ['check_no_concealment', '明确自己查清委屈，同时不隐瞒苟安真实过错', '玩家本人查清委屈，同时不藏真实过错。', true],
        ], [['check_report'], ['check_no_concealment']]);
        level('responsibility', 1, '提出由自己去查、回来说明或正式报告的行动，但责任边界尚不完整。行动可能积极而推理错误，严谨另评。', [
            ['own_action', '提出由自己去查、回来说明或正式报告的行动', '玩家本人愿查、回来说明或报告（任一），只要求别人去做不成立。', true],
        ]);
    } else if (round === 'O1') {
        level('trust', 2, '理解处境，并给出可信的核查、如实带回结果的合作承诺。', [
            ['understanding', '理解处境', '本次话语体现对苟安处境的理解；自然反证说明委屈也可成立。', true],
            ['checking', '可信的核查', '玩家本人承诺可信的核查合作；命令他人行动不等于本人承诺。', true],
            ['truthful_return', '如实带回结果的合作承诺', '玩家本人承诺如实带回结果，允许有明确依据的同义或含蓄表达。', true],
        ]);
        level('rigor', 2, '准确使用日期等已知事实指出解释缺口，不把怀疑说成阴谋已实。', [
            ['factual_gap', '准确使用日期等已知事实指出解释缺口', '本次原话用真实已知资料说明解释缺口。事实资料只核对其真假。', true],
            ['no_plot_assertion', '不把怀疑说成阴谋已实', '没有把怀疑说成已经证实的阴谋；没有这种断言也可满足。', false],
        ]);
        level('responsibility', 2, '提出具体核验后如实上报；或愿查委屈且明确不藏真实过错。', [
            ['check_report', '提出具体核验后如实上报', '玩家本人提出具体核验后如实上报，行动主体不能换成苟安或丞相。', true],
            ['check_no_concealment', '愿查委屈且明确不藏真实过错', '玩家本人愿查委屈，且明确不藏真实过错。', true],
        ], [['check_report'], ['check_no_concealment']]);
        level('responsibility', 1, '自己去查、回来说明或正式报告，责任边界尚不完整。', [
            ['own_action', '自己去查、回来说明或正式报告', '玩家本人愿查、回来说明或正式报告（任一）；只让别人交材料或调查不成立。', true],
        ]);
    } else {
        level('trust', 2, '承认救命与欺瞒并存，回应处境，并给出可信的具体陪伴或帮助。', [
            ['rescue', '承认救命与欺瞒并存', '本次原话认可苟安救过自己或这份恩情；仅资料中存在救命、未否认恩情或只提出帮助都不等于表达认可。允许自然同义和含蓄认可。', true],
            ['deception', '承认救命与欺瞒并存', '本次原话承认苟安也有欺瞒、利用自己的行为。与救命认可须同时存在，不能以多种过错并存代替。', true],
            ['situation', '回应处境', '本次原话回应苟安的处境，而非只处置事实。', true],
            ['help', '可信的具体陪伴或帮助', '玩家本人提出可信的具体陪伴或帮助；只要求他人去做不能算本人帮助。', true],
        ]);
        level('rigor', 2, '准确结合缺粮、已知责任、尚未实施计划等关键区别，不保证免责或掌控魏方。', [
            ['distinctions', '准确结合缺粮、已知责任、尚未实施计划等关键区别', '本次原话准确结合关键区别，允许自然概括，不要求机械复述全案；已得资料仅核真假。', true],
            ['no_immunity', '不保证免责或掌控魏方', '本次原话没有保证免责。未作这种保证即可，不要求补说固定免责句。', false],
            ['no_enemy_control', '不保证免责或掌控魏方', '本次原话没有保证掌控魏方。未作这种保证即可，不要求补说固定句。', false],
        ]);
        level('responsibility', 2, '自己承担具体送报、确认送达或陪同补救；不藏各人责任，接受不能保证处分。', [
            ['own_action', '自己承担具体送报、确认送达或陪同补救', '玩家本人承担具体送报、确认送达或陪同补救（任一），不能只命令苟安或丞相。', true],
            ['no_concealment', '不藏各人责任', '本次原话保留各人应负责任，不以帮助为由隐去过错。', true],
            ['uncertain_disposition', '接受不能保证处分', '接受处分仍不能保证，允许明确语义支持的同义或含蓄表达，不要求固定措辞。', true],
        ]);
        level('responsibility', 1, '自己愿去报告、联络或陪同，具体步骤和责任边界尚不完整。', [
            ['own_action', '自己愿去报告、联络或陪同', '玩家本人愿报告、联络或陪同（任一），只要求别人去做不成立。', true],
        ]);
    }
    return { version: finalAssessmentVersion, rubricVersion: rubric.version, round, variant: legacy ? 'legacy-open1' : 'current-round', items, levels };
}
export type QuoteSource = { id: string; start: number; end: number; text: string };
export function playerQuoteSources(input: string): QuoteSource[] {
    const matches = [...input.matchAll(/[^。！？\n]+[。！？\n]?|[。！？\n]/g)];
    return matches.map((m, i) => ({ id: `p${i + 1}`, start: m.index!, end: m.index! + m[0].length, text: m[0] }));
}
export function quoteFromSources(refs: unknown, input: string, sources: QuoteSource[], field: string, required = true) {
    if (!Array.isArray(refs) || refs.some(id => typeof id !== 'string' || !sources.some(s => s.id === id)) || new Set(refs).size !== refs.length
        || (required && !refs.length)) dialogueProtocolError('assessment-source-reference-invalid', field);
    if (!refs.length) return '';
    const selected = sources.filter(s => refs.includes(s.id));
    return input.slice(Math.min(...selected.map(s => s.start)), Math.max(...selected.map(s => s.end)));
}
export function validateConditionAssessments(value: any, scores: Judgment['scores'], plan: NecessaryConditions, input: string, sources: QuoteSource[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== plan.items.length)
        dialogueProtocolError('condition-assessments-incomplete', 'responseAudit.conditions');
    for (const item of plan.items) {
        const proof = value[item.id], field = `responseAudit.conditions.${item.id}`;
        if (!proof || typeof proof.met !== 'boolean' || typeof proof.explanation !== 'string' || !proof.explanation.trim() || proof.explanation.length > 300)
            dialogueProtocolError('condition-assessment-invalid', field);
        quoteFromSources(proof.sourceRefs, input, sources, `${field}.sourceRefs`, proof.met && item.needsWords);
    }
    for (const key of ['trust', 'rigor', 'responsibility'] as const) {
        const level = plan.levels[key]?.[String(scores[key].delta)];
        if (level && !level.alternatives.some(group => group.every(id => value[id].met)))
            dialogueProtocolError('final-score-condition-contradiction', `responseAudit.scores.${key}.delta`);
    }
}
