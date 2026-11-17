'use strict';
// Standalone preview rules. No game state, AI service or online planning data is modified.
globalThis.GrainJudgment = (() => {
  const stages = ['粮队领取', '调拨发出', '入仓', '实际征收', '地方应征'];
  const evidence = {
    receipt: ['本队领取凭据', '记有本队签收的这一批粮及经手人。', '本队材料 · 演示摘述'],
    dispatch: ['出仓交付记录', '本批出仓交付与本队签收相合；领粮时已有缺额。', '仓中材料 · 演示摘述'],
    loss: ['途中损耗记录', '本队途中有损耗登记。它记的是途中损耗，不能单凭这一项解释整批缺额。', '粮队材料 · 演示摘述'],
    storage: ['本批入仓记录', '本批实际入仓粮已有发往本队的记录，没有另存的一批足额粮。', '仓中材料 · 演示摘述'],
    collected: ['地方实收记录', '实收与本批入仓相合；实际未足额。', '征收材料 · 演示摘述'],
    required: ['应征记录', '记的是要求交纳的数量，不是已收到的现粮。', '征收材料 · 演示摘述']
  };
  const steps = [
    { question: '这笔缺额，该从哪里追问？', choices: ['先核对领取之前的缺口', '先追问苟安经手后的损耗'], available: ['receipt', 'dispatch', 'loss'], needs: ['receipt', 'dispatch'] },
    { question: '入仓的这批粮，后来发往了哪里？', choices: ['沿本批发运记录，继续往前查', '足额粮仍被扣在仓里'], available: ['receipt', 'dispatch', 'loss', 'storage'], needs: ['dispatch', 'storage'] },
    { question: '地方收到的粮，是否都记入仓中？', choices: ['缺口还应往征收端找', '已经收足，只是没有入仓'], available: ['receipt', 'dispatch', 'loss', 'storage', 'collected'], needs: ['storage', 'collected'] },
    { question: '应当交多少，便是已经收到多少吗？', choices: ['这批粮，并未备齐', '应征额就是备好的现粮'], available: ['receipt', 'dispatch', 'loss', 'storage', 'collected', 'required'], needs: ['collected', 'required'] }
  ];
  const missingHints = [
    '现有引用还不能确定缺口何时出现；途中损耗不能说明领粮时是否已经短缺。',
    '要看本批粮的去向，须把入仓与发运两端对上；经手人与途中损耗不能代替这层核对。',
    '还缺地方实收与入仓之间的对应。只看仓内记录，不能断定征收端的情况。',
    '要区分应交与实收，必须同时核对这两栏；只引应征额，不能证明有粮或无粮。'
  ];
  function assess(index, choice, proofIds) {
    const step = steps[index];
    if (!step || ![0, 1].includes(choice)) return { ok: false, reason: '先选一个判断，再放入依据。' };
    if (!Array.isArray(proofIds) || !proofIds.length) return { ok: false, reason: '还没有放入支持这个判断的材料。' };
    const ids = new Set(proofIds);
    if ([...ids].some(id => !step.available.includes(id))) return { ok: false, reason: '这一步尚未取得这份材料，不能将它当作依据。' };
    if (choice === 1 && index > 0) {
      const refute = index === 1 ? 'storage' : index === 2 ? 'collected' : 'required';
      const contradictions = [null, '入仓记录写明本批实粮已有发往本队的记录，与你所说的“足额粮仍被扣住”冲突。', '实收记录写明本批并未收足，不能推出“已经收足，只是未入仓”。', '应征记录写的是要求交多少，不能据此把应征额当成现粮。'];
      return { ok: false, reason: ids.has(refute) ? contradictions[index] : '这些材料不足以支持这个断言。请重新核对所指的粮数和环节。' };
    }
    if (index === 0 && choice === 1) {
      if (!ids.has('receipt') || !ids.has('loss')) return { ok: false, reason: '追问经手后的损耗，需要经手依据和实际损耗记录；只凭一份记录，还不足以这样行动。' };
      return { ok: true, kind: 'inquiry', route: 'ask-loss', reason: '材料支持向经手人询问损耗；还不能认定整笔缺额由他造成。' };
    }
    if (!step.needs.every(id => ids.has(id))) return { ok: false, reason: missingHints[index] };
    return { ok: true, kind: 'supported', route: 'trace', reason: ['交付与签收相合，缺口在领粮时已存在。可以继续向前核查。', '本批实粮的入仓与发运已有对应，可以继续查来粮。', '地方实收与入仓相合，应继续核查实收与应征的差别。', '应征与实收并不相等，这批粮并未备齐。'][index] };
  }
  return { stages, evidence, steps, assess };
})();
