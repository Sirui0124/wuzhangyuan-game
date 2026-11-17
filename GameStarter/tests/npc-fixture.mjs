export const npcTurn = (input, code = 'ok', text = code === 'ok' ? '好，速速转达，莫误军情。' : '军情不能耽搁，急报怎么办？') => ({
 schemaVersion:1,npcId:'weiyan',stage:input.stage,
 classification:{code,disposition:code==='ok'?'accept':'revise',reason:'测试用已核验判定。',evidenceIds:[]},
 reply:{speaker:'魏延',text},
});
