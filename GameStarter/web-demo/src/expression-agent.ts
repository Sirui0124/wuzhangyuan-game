import { hasExpressionMaterial, type ExpressionGenerationInput } from './expression-contract';
import { GameApi } from '../../assets/scripts/GameApi';
import type { ExpressionJudge, ExpressionGenerator } from './chapter-session';
import { createWeiyanJudge } from './weiyan-judgment';
import { expressionWriterPrompt, expressionPromptScope } from './expression-prompts';
import { expressionScenePrompt, expressionLengthBudget } from './expression-scene-prompts';

const decode = (text: string) => JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '').trim());

/** Composition produces an editable draft. Only confirmed speech is judged by the NPC. */
export function expressionAgents(api: GameApi): { judge: ExpressionJudge; generate: ExpressionGenerator } {
    const generate = async ({ brief, verificationSources }: ExpressionGenerationInput, signal: AbortSignal) => {
        signal.throwIfAborted();
        const allowedIds = brief.selectedEvidence.map(item => item.id);
        const intent = brief.playerIntent;
        if ((intent.draft !== undefined || intent.focus !== undefined) &&
            ((intent.draft !== undefined && typeof intent.draft !== 'string') || (intent.focus !== undefined && typeof intent.focus !== 'string') ||
                intent.words !== (intent.draft?.trim() || intent.focus?.trim() || '')))
            throw new Error('表达原稿与补充输入不一致');
        if (brief.schemaVersion !== 2 ||
            !hasExpressionMaterial(allowedIds.length, intent.words) ||
            brief.selectedEvidence.some(item => !verificationSources.some(source => source.evidenceId === item.id)))
            throw new Error('表达资料不完整');
        const scene = expressionScenePrompt(brief.conversation.stage), length = expressionLengthBudget(brief);
        const prompt = expressionWriterPrompt.replace('资料：', `\n场景版本：${scene.id}\n${scene.writer}\n${expressionPromptScope(brief)}\n本次尽量${length.target}字，目标上限${length.maximum}字。合并重复意思，不截断、不丢条件。\n资料：`);
        let repair: {candidate: string; reason: string} | undefined;
        for (let attempt=0; attempt<2; attempt++) {
            const currentPrompt=repair?prompt.replace('资料：','\n本次编辑要求：'+repair.reason+'\nrepair.candidate是上一稿，仅供对照。仍忠实保留brief中的原意与条件，不把上一稿当作新增事实。若要求缩短，合并重复含义并实际改写，不要原样返回。\n资料：'):prompt;
            const response = await api.respond({text:currentPrompt + JSON.stringify(repair ? {brief,repair} : brief),temperature:0},signal,45000);
            signal.throwIfAborted();
            let result: any;
            try { result=decode(response.text); }
            catch {
                if (attempt) throw new Error('润色服务没有返回可读取的文字，请重试。');
                repair={candidate:'',reason:'请返回合法JSON，text是可编辑台词，不要解释。'};
                continue;
            }
            const text=typeof result?.text==='string'?result.text.trim():'';
            if (!text) {
                // Legacy refusal statuses cannot become a content gate for the player.
                if (['needs_revision','input_conflict'].includes(result?.status) && intent.words.trim())
                    return {text:intent.words.trim(),evidenceIds:[]};
                if (!attempt) {
                    repair={candidate:'',reason:'不要审核或拒绝玩家的立场。请整理所选材料与原话，返回非空text，后果由确认后的NPC判断。'};
                    continue;
                }
                if (['needs_revision','input_conflict'].includes(result?.status)) {
                    const fallback=[...brief.selectedEvidence.map(e=>e.meaning)].join('');
                    if(fallback)return {text:fallback,evidenceIds:allowedIds};
                }
                throw new Error('润色服务没有返回文字，请重试。');
            }
            if (text.length>length.maximum && !attempt) {
                repair={candidate:text,reason:`请压缩到${length.maximum}字左右，保留原意与条件，合并重复句，不截断。`};
                continue;
            }
            // References describe a draft, not approval. Invalid metadata never blocks speech.
            const evidenceIds: string[]=Array.isArray(result.evidenceIds)?[...new Set<string>(result.evidenceIds.filter((id:unknown)=>typeof id==='string'&&allowedIds.includes(id)))]:[];
            return {text,evidenceIds};
        }
        throw new Error('润色服务暂时未完成，请重试。');
    };
    return {generate,judge:createWeiyanJudge(api)};
}
