import type { DialogueNode } from '../schema/narrative';

/** Format samples, not a runnable chapter; referenced IDs belong to wuzhang. */
export const examples: DialogueNode[] = [
  {
    id: 'guard.ask_urgent', sceneId: 'camp_gate', characterId: 'guard',
    topicId: 'urgent_rule', title: '若有紧急军情呢？', targetStatement: null, trigger: 'topic', priority: 10,
    availableWhen: { all: [
      { flag: 'loop.player_alive', equals: true },
      { flag: 'loop.guard_heard_urgent_rule', equals: false },
    ] },
    repeat: 'once_per_loop',
    lines: [{ id: 'guard.urgent_rule', speakerId: 'guard',
      text: '急报不能扣。你我只管守门，不能替将军改传报的规矩。',
      effects: [
        { type: 'setFlag', flag: 'loop.guard_heard_urgent_rule', value: true },
        { type: 'setFlag', flag: 'memory.knows_urgent_rule', value: true },
        { type: 'grantEvidence', evidenceId: 'guard_statement' },
      ] }],
    choices: [], freeInput: null, onComplete: [], next: null,
  },
  {
    id: 'relay.ask_contact', sceneId: 'relay_tent', characterId: 'relay',
    topicId: 'contact_jiangwei', title: '请你向姜将军递句话', targetStatement: '守门是守门，递话是递话。你找我有什么事？',
    trigger: 'present_evidence', priority: 20,
    availableWhen: { all: [
      { flag: 'memory.knows_relay_tent', equals: true },
      { flag: 'loop.relay_agreed', equals: false },
      { any: [
        { evidence: 'entry_notice', mode: 'presented' },
        { evidence: 'scout_statement', mode: 'presented' },
      ] },
    ] },
    repeat: 'repeatable',
    lines: [{ id: 'relay.ask_reason', speakerId: 'relay',
      text: '你要递什么话？为何要改传报的办法？', effects: [] }],
    choices: [],
    freeInput: {
      intentOptions: [{ id: 'ask_contact', label: '请乙代问接报办法' }, { id: 'revise_plan', label: '修改递话安排' }],
      placeholder: '说明眼前的冲突，以及希望乙代问的安排。',
      guidingQuestions: ['两条证据分别说明什么？', '你请乙问什么？', '怎样避免耽误军情？'],
      starterText: '今夜的禁入安排与眼前军情需要一起处理。我想请你……',
      maxLength: 1000, evidenceSelection: 'required', judgeId: 'relay_contact',
      outcomes: {
        accept: {
          reply: [{ id: 'relay.agrees', speakerId: 'relay', text: '可以。我替你递话，是否准许还得姜将军决定。', effects: [] }],
          effects: [{ type: 'setFlag', flag: 'loop.relay_agreed', value: true }],
          next: 'relay.send_request',
        },
        need_evidence: { reply: [{ id: 'relay.missing_evidence', speakerId: 'relay', text: '你说军情紧急，报信的人怎么说？', effects: [] }], effects: [], next: null },
        need_plan: { reply: [{ id: 'relay.missing_plan', speakerId: 'relay', text: '禁入我知道。你要我向姜将军问什么？', effects: [] }], effects: [], next: null },
        out_of_scope: { reply: [{ id: 'relay.no_authority', speakerId: 'relay', text: '我能递话，不能替将军下令。', effects: [] }], effects: [], next: null },
        clarify: { reply: [{ id: 'relay.clarify', speakerId: 'relay', text: '你是请我代问，还是说已经得了命令？', effects: [] }], effects: [], next: null },
      },
    },
    onComplete: [], next: null,
  },
];
