import { GameApi, type GameApiRequest, type GameApiResponse } from '../../../../assets/scripts/GameApi';
import { validateJietingRequest, parseJietingJudgment } from './ai-parser';
import { jietingPrompt } from './ai-prompt';
import { reviewJietingReply } from './ai-response';
import { jietingReplyLimits, type JietingEvaluationRequest, type JietingJudgment } from './ai-contracts';
export * from './ai-contracts';
export { parseJietingJudgment, validateJietingRequest, jietingPrompt };
export type JietingResponder = { respond(request: GameApiRequest, signal?: AbortSignal): Promise<GameApiResponse> };

export async function judgeJietingDialogue(request: JietingEvaluationRequest, signal: AbortSignal,
    api: JietingResponder = new GameApi()): Promise<JietingJudgment> {
    validateJietingRequest(request);
    signal.throwIfAborted();
    // Snapshot before awaiting. UI/session must also compare contextKey before accepting.
    const committed = structuredClone(request);
    const prompt = jietingPrompt(committed);
    let repair = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        const result = await api.respond({ text: prompt + repair, temperature: 0 }, signal);
        signal.throwIfAborted();
        try { return await reviewJietingReply(parseJietingJudgment(result.text, committed), committed, signal, api); }
        catch (error) {
            if (attempt || !(error instanceof Error) || !error.message.startsWith('回应未核对完整')) throw error;
            // Repair the protocol once. Neither an incomplete response nor its repair commits a turn.
            repair = `\n上次返回未通过结构与原话核验，请按相同资料重新返回完整JSON。criteria是一个对象，每个条件是其中一个属性，属性之间仅用逗号，不能写成多个对象的},{。尤其检查acknowledgment是否误放了问句：它只写一两句陈述，如“侧路的军情我听见了，添兵的事还得议一议。”；问号与所有待回答的问题只能放followup.question，不能两处重复。reasoning.linked=false时supportedTroops必须为0。逐项核对原话、实际已获线索、argument及类别；acknowledgment只用一至两句陈述且最多${jietingReplyLimits.acknowledgment}字，必要问题放followup.question且最多${jietingReplyLimits.question}字，不能判完整后再加新问题。回应须与本次criteria一致，保留风险的不确定程度。保留原判定标准，不能为了修正格式把失败改成功。`;
        }
    }
    throw new Error('回应未核对完整，原话已保留，请重试。');
}
