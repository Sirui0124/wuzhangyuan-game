/** Reject lecturing contrasts before displaying NPC prose; never change a judgment. */
export function hasDidacticContrast(text: string): boolean {
    return /(?:莫|别|勿|休|不要|不可|不能|不许|切勿)(?:再|要)?(?:把|将|拿|以)[^。！？!?\n]{0,60}(?:当|视为|算作|充作)|(?:不是|并非)[^。！？!?\n]{0,40}(?:而是|才是)|(?:莫|别|不要|勿)(?:以为|误以为)/.test(text);
}

export function hasProcessWording(text: string): boolean {
    return /核令|具体安排|验收|责任边界|落实处置|方案成立|按.{0,6}条件/.test(text);
}

export const npcVoiceDirection = '人物只说眼前想说的话：同意就应下，着急就催，怀疑就问具体的一处。不要讲道理、列检查清单、拆解责任或复述后台判断。禁止“莫把／不要把／别把……当作……”及换词后的同类说教，也不用“不是……而是……”纠正玩家。可见对白不用“核令、具体安排、验收、责任边界、按条件试”等流程用语。保留当前必要的问题或安排，具体事实和判断条件仍在后台核验。';
