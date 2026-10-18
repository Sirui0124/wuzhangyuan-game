/** 五丈原编剧格式参考：摘自正式章节，非独立可运行章节。
 * 未收录的场景、人物、证据和节点均引用 ../chapters/wuzhang/chapter.json。
 * 正式章节是内容源；本文件用于说明字段，修改它不会改变游戏。
 */
import type { DialogueNode, JudgeDefinition, Action, PromiseDefinition, EventRule } from '../schema/narrative';

export const dialogues: DialogueNode[] = [
  {
    "id": "guard.ask_urgent",
    "sceneId": "camp_gate",
    "characterId": "guard",
    "topicId": "urgent_rule",
    "title": "若有紧急军情呢？",
    "targetStatement": null,
    "trigger": "topic",
    "priority": 10,
    "availableWhen": {
      "all": [
        {
          "all": [
            {
              "flag": "loop.player_alive",
              "equals": true
            },
            {
              "flag": "loop.result",
              "equals": "none"
            }
          ]
        },
        {
          "flag": "loop.guard_heard_urgent_rule",
          "equals": false
        },
        {
          "flag": "memory.knows_urgent_rule",
          "equals": false
        }
      ]
    },
    "repeat": "once_per_loop",
    "lines": [
      {
        "id": "guard.ask_urgent.text",
        "speakerId": "guard",
        "text": "急报自然得报。可从哪儿报、由谁接，你我说了不算。没得令就换了规矩，事后问下来，谁替你担？",
        "effects": [
          {
            "type": "setFlag",
            "flag": "loop.guard_heard_urgent_rule",
            "value": true
          },
          {
            "type": "setFlag",
            "flag": "memory.knows_urgent_rule",
            "value": true
          },
          {
            "type": "grantEvidence",
            "evidenceId": "guard_statement"
          }
        ]
      }
    ],
    "choices": [],
    "freeInput": null,
    "onComplete": [],
    "next": null
  },
  {
    "id": "relay.contact",
    "sceneId": "relay_tent",
    "characterId": "relay",
    "topicId": "contact_jiangwei",
    "title": "请乙向姜维递句话",
    "targetStatement": "找我递话？先说清谁来的军报，要请姜将军办什么。",
    "trigger": "present_evidence",
    "priority": 10,
    "availableWhen": {
      "all": [
        {
          "all": [
            {
              "flag": "loop.player_alive",
              "equals": true
            },
            {
              "flag": "loop.result",
              "equals": "none"
            }
          ]
        },
        {
          "all": [
            {
              "flag": "memory.seen_execution",
              "equals": true
            },
            {
              "flag": "memory.knows_relay_tent",
              "equals": true
            }
          ]
        },
        {
          "flag": "loop.relay_location",
          "equals": "relay_tent"
        },
        {
          "flag": "loop.relay_agreed",
          "equals": false
        },
        {
          "flag": "loop.route",
          "equals": "none"
        }
      ]
    },
    "repeat": "repeatable",
    "lines": [
      {
        "id": "relay.contact.open",
        "speakerId": "relay",
        "text": "找我递话？先喘口气。谁来的军报，要请姜将军办什么，你说清楚。",
        "effects": []
      }
    ],
    "choices": [],
    "freeInput": {
      "intentOptions": [
        {
          "id": "ask_contact",
          "label": "请乙代问接报办法"
        },
        {
          "id": "revise_plan",
          "label": "修改递话请求"
        }
      ],
      "placeholder": "说明禁入和急报同时存在，请乙向帐内姜维问清可行办法。",
      "guidingQuestions": [
        "拿哪些眼前凭据给他看？这些凭据能说明什么？",
        "让谁接报、递给谁，怎样保证军情不耽误？",
        "对方最担心什么？你怎样回应？"
      ],
      "starterText": "帐前不许闲人擅入，可这份军报又等不得。能否请你向姜将军……",
      "maxLength": 1000,
      "evidenceSelection": "optional",
      "judgeId": "relay_contact",
      "outcomes": {
        "accept": {
          "reply": [
            {
              "id": "relay.contact.feedback.accept",
              "speakerId": "relay",
              "text": "话我听明白了。可你说的凭据，我还没见齐。先拿来，我才好照实禀报。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        },
        "need_evidence": {
          "reply": [
            {
              "id": "relay.contact.feedback.need_evidence",
              "speakerId": "relay",
              "text": "你说帐前有禁令，又说敌兵已近，凭据呢？拿来给我看。若已得姜将军准信，也一并拿来。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        },
        "need_plan": {
          "reply": [
            {
              "id": "relay.contact.feedback.need_plan",
              "speakerId": "relay",
              "text": "不进帐，那军情怎么进去？由谁接，递给谁，你总得有个说法。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        },
        "out_of_scope": {
          "reply": [
            {
              "id": "relay.contact.feedback.out_of_scope",
              "speakerId": "relay",
              "text": "这话我不能替你递。扣住军报，拘住魏将军，拖到明日——哪一件是你我能做主的？",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        },
        "clarify": {
          "reply": [
            {
              "id": "relay.contact.feedback.clarify",
              "speakerId": "relay",
              "text": "你是要我代问，还是已经奉了令？先说清楚。若让我接报，后头又怎么递进去？",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        }
      }
    },
    "onComplete": [],
    "next": null
  },
  {
    "id": "relay.send_request",
    "sceneId": "relay_tent",
    "characterId": "relay",
    "topicId": "send_request",
    "title": "托乙向姜维递话",
    "targetStatement": null,
    "trigger": "topic",
    "priority": 10,
    "availableWhen": {
      "all": [
        {
          "all": [
            {
              "flag": "loop.player_alive",
              "equals": true
            },
            {
              "flag": "loop.result",
              "equals": "none"
            }
          ]
        },
        {
          "flag": "loop.relay_agreed",
          "equals": true
        },
        {
          "flag": "loop.request_sent",
          "equals": false
        }
      ]
    },
    "repeat": "repeatable",
    "lines": [
      {
        "id": "relay.send_request.open",
        "speakerId": "relay",
        "text": "好，我替你问。你要问哪句话？可别等我到了帘边，又改口。",
        "effects": []
      }
    ],
    "choices": [
      {
        "id": "relay.send_request.receive",
        "label": "请问姜将军：今夜能否由你在帐外接报？",
        "intentId": "ask_contact",
        "visibleWhen": {
          "all": []
        },
        "enabledWhen": {
          "all": []
        },
        "lockedText": "请先完成当前提示中的前提；阅读和重试不会推进事件。",
        "actionId": "relay.send_request",
        "outcome": {
          "reply": [
            {
              "id": "relay.send_request.receive.reply",
              "speakerId": "relay",
              "text": "成。你在外头候着，我去禀报。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        }
      },
      {
        "id": "relay.send_request.coordinate",
        "label": "将禁令与敌情一并禀报，请姜将军安排",
        "intentId": "ask_contact",
        "visibleWhen": {
          "all": []
        },
        "enabledWhen": {
          "all": []
        },
        "lockedText": "请先完成当前提示中的前提；阅读和重试不会推进事件。",
        "actionId": "relay.send_request",
        "outcome": {
          "reply": [
            {
              "id": "relay.send_request.coordinate.reply",
              "speakerId": "relay",
              "text": "我把帐前禁令和敌情一并禀明。该如何处置，听姜将军的。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        }
      },
      {
        "id": "relay.send_request.delay",
        "label": "命魏延止步，军情明早再报",
        "intentId": "revise_plan",
        "visibleWhen": {
          "all": []
        },
        "enabledWhen": {
          "all": []
        },
        "lockedText": "请先完成当前提示中的前提；阅读和重试不会推进事件。",
        "actionId": null,
        "outcome": {
          "reply": [
            {
              "id": "relay.send_request.delay.reply",
              "speakerId": "relay",
              "text": "等到明早？敌兵也肯等么？这话不成。你若想在帐外接报，我可以替你问。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        }
      }
    ],
    "freeInput": null,
    "onComplete": [],
    "next": null
  },
  {
    "id": "jiangwei.approval",
    "sceneId": "relay_tent",
    "characterId": "jiangwei",
    "topicId": "approval",
    "title": "帘边的有限准信",
    "targetStatement": null,
    "trigger": "event",
    "priority": 10,
    "availableWhen": {
      "all": [
        {
          "all": [
            {
              "flag": "loop.player_alive",
              "equals": true
            },
            {
              "flag": "loop.result",
              "equals": "none"
            }
          ]
        },
        {
          "flag": "loop.request_sent",
          "equals": true
        },
        {
          "flag": "loop.jiangwei_approval",
          "equals": false
        }
      ]
    },
    "repeat": "once_per_loop",
    "lines": [
      {
        "id": "jiangwei.approval.relay",
        "speakerId": "relay",
        "text": "禀姜将军，魏将军携急报将至。帐前有禁令，可否由小卒在外接报，递入请将军处置？",
        "effects": []
      },
      {
        "id": "jiangwei.approval.order",
        "speakerId": "jiangwei",
        "text": "军情不可迟误。今夜这份急报，由你在外接了递进来。文长在帐外稍候，我得报便出帐。写下准信，拿去告知他。",
        "effects": [
          {
            "type": "setFlag",
            "flag": "loop.jiangwei_approval",
            "value": true
          },
          {
            "type": "grantEvidence",
            "evidenceId": "approval_note"
          }
        ]
      },
      {
        "id": "jiangwei.approval.scope",
        "speakerId": "relay",
        "text": "拿好。只准今夜这份军报由我转递。别拿它去拦人，更别替将军发令。军报得送到，回话也得带回来。",
        "effects": []
      }
    ],
    "choices": [],
    "freeInput": null,
    "onComplete": [],
    "next": null
  },
  {
    "id": "weiyan.negotiate",
    "sceneId": "report_post",
    "characterId": "weiyan",
    "topicId": "wait_plan",
    "title": "出示凭据，商议帐外接报",
    "targetStatement": "军情不能误。要我在帐外等，谁接报，谁处置？",
    "trigger": "present_evidence",
    "priority": 10,
    "availableWhen": {
      "all": [
        {
          "all": [
            {
              "flag": "loop.player_alive",
              "equals": true
            },
            {
              "flag": "loop.result",
              "equals": "none"
            }
          ]
        },
        {
          "flag": "loop.weiyan_status",
          "equals": "approaching"
        },
        {
          "flag": "loop.route",
          "equals": "none"
        }
      ]
    },
    "repeat": "repeatable",
    "lines": [
      {
        "id": "weiyan.negotiate.open",
        "speakerId": "weiyan",
        "text": "要我在这里等，可以。谁接报，谁处置？有姜维的准信就拿来；没有，就莫说奉了令。",
        "effects": []
      }
    ],
    "choices": [],
    "freeInput": {
      "intentOptions": [
        {
          "id": "propose_wait",
          "label": "请魏延暂缓并提出接报办法"
        },
        {
          "id": "propose_handoff",
          "label": "按本轮准信安排交接"
        },
        {
          "id": "revise_plan",
          "label": "补充或修订传报方案"
        }
      ],
      "placeholder": "为何不必闯帐？由谁接报，怎样送达？若已有许可，请当面出示。",
      "guidingQuestions": [
        "拿哪些眼前凭据给他看？这些凭据能说明什么？",
        "让谁接报、递给谁，怎样保证军情不耽误？",
        "对方最担心什么？你怎样回应？"
      ],
      "starterText": "将军，军情不敢耽误。若在帐外接报……",
      "maxLength": 1000,
      "evidenceSelection": "optional",
      "judgeId": "weiyan_wait",
      "outcomes": {
        "accept": {
          "reply": [
            {
              "id": "weiyan.negotiate.feedback.accept",
              "speakerId": "weiyan",
              "text": "你说的我听见了，可凭据还未齐。军情不能凭一句话交出去，拿来再说。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        },
        "need_evidence": {
          "reply": [
            {
              "id": "weiyan.negotiate.feedback.need_evidence",
              "speakerId": "weiyan",
              "text": "禁令、敌情，你凭什么说？拿来我看。说是姜维准了，便把他的准信拿出来。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        },
        "need_plan": {
          "reply": [
            {
              "id": "weiyan.negotiate.feedback.need_plan",
              "speakerId": "weiyan",
              "text": "不进帐，那由谁接我的军报？你只叫我等，敌兵却不会等。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        },
        "out_of_scope": {
          "reply": [
            {
              "id": "weiyan.negotiate.feedback.out_of_scope",
              "speakerId": "weiyan",
              "text": "扣报？拘我？还要等到明日？你有几颗脑袋，敢替中军下这种令！",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        },
        "clarify": {
          "reply": [
            {
              "id": "weiyan.negotiate.feedback.clarify",
              "speakerId": "weiyan",
              "text": "你要去请姜维，还是他已命人接报？说清楚。军报交给谁，我要见着人。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        }
      }
    },
    "onComplete": [],
    "next": null
  },
  {
    "id": "weiyan.handoff",
    "sceneId": "waiting_area",
    "characterId": "weiyan",
    "topicId": "handoff",
    "title": "当面交接军情",
    "targetStatement": null,
    "trigger": "topic",
    "priority": 10,
    "availableWhen": {
      "all": [
        {
          "all": [
            {
              "all": [
                {
                  "flag": "loop.player_alive",
                  "equals": true
                },
                {
                  "flag": "loop.result",
                  "equals": "none"
                }
              ]
            },
            {
              "flag": "loop.weiyan_status",
              "equals": "waiting"
            }
          ]
        },
        {
          "flag": "loop.route",
          "equals": "authorized"
        },
        {
          "flag": "loop.relay_location",
          "equals": "waiting_area"
        },
        {
          "flag": "loop.report_status",
          "equals": "none"
        }
      ]
    },
    "repeat": "repeatable",
    "lines": [
      {
        "id": "weiyan.handoff.open",
        "speakerId": "weiyan",
        "text": "传令卒，近前听报。敌兵已逼近我营，将这军情即刻递入，听姜维处置。",
        "effects": []
      }
    ],
    "choices": [
      {
        "id": "weiyan.handoff.now",
        "label": "让魏延当面交代军情，由乙递入",
        "intentId": "propose_handoff",
        "visibleWhen": {
          "all": []
        },
        "enabledWhen": {
          "all": []
        },
        "lockedText": "请先完成当前提示中的前提；阅读和重试不会推进事件。",
        "actionId": "report.handoff",
        "outcome": {
          "reply": [
            {
              "id": "weiyan.handoff.now.reply",
              "speakerId": "relay",
              "text": "军情已递入。姜将军有话带给魏将军，你来听。",
              "effects": []
            }
          ],
          "effects": [],
          "next": null
        }
      }
    ],
    "freeInput": null,
    "onComplete": [],
    "next": null
  },
  {
    "id": "ending.execution",
    "sceneId": "camp_gate",
    "characterId": "narrator",
    "topicId": "ending",
    "title": "主灯守住，越职被处斩",
    "targetStatement": null,
    "trigger": "event",
    "priority": 10,
    "availableWhen": {
      "flag": "loop.result",
      "equals": "execution"
    },
    "repeat": "once_per_loop",
    "lines": [
      {
        "id": "ending.execution.lamp",
        "speakerId": "narrator",
        "text": "甲在帐外通报，姜维随即出帐。魏延迎上前，两人的声音渐渐远去。帘后那盏灯，仍稳稳地亮着。",
        "effects": []
      },
      {
        "id": "ending.execution.disclaimer",
        "speakerId": "narrator",
        "text": "剧情提示：接下来的越职追责与处斩为游戏架空分支，不代表蜀汉真实军法，亦非诸葛亮下令。军报得到处置，并未免去这条分支的追责。",
        "effects": []
      },
      {
        "id": "ending.execution.sentence",
        "speakerId": "executor",
        "text": "未奉军令，擅改急报传递，罪责已定。押下，处斩！",
        "effects": []
      },
      {
        "id": "ending.execution.clue",
        "speakerId": "relay",
        "text": "你怎么不先来侧帐找我？递句话，问过姜将军，得了准信再办……唉，何至于此。",
        "effects": [
          {
            "type": "setFlag",
            "flag": "memory.knows_relay_tent",
            "value": true
          }
        ]
      },
      {
        "id": "ending.execution.death",
        "speakerId": "narrator",
        "text": "你回头看了一眼帐门。灯还亮着，甲却低下了头。刀影落下，夕阳、营栅和那盏灯一齐沉入黑暗。",
        "effects": [
          {
            "type": "setFlag",
            "flag": "loop.player_alive",
            "value": false
          },
          {
            "type": "setFlag",
            "flag": "memory.seen_execution",
            "value": true
          }
        ]
      },
      {
        "id": "ending.execution.result",
        "speakerId": "narrator",
        "text": "本次结局：主灯守住，军情送达，姜维已处置；你因越职转报被处斩。回到傍晚后，记忆保留，证据、准信与行动进度重新开始。",
        "effects": []
      }
    ],
    "choices": [],
    "freeInput": null,
    "onComplete": [],
    "next": null
  }
];

export const judges: JudgeDefinition[] = [
  {
    "id": "relay_contact",
    "acceptedIntentIds": [
      "ask_contact",
      "revise_plan"
    ],
    "requiredPoints": [
      "语义认可须同时理解禁入与真实急报；不把告示当扣报授权。",
      "请求乙从帐外向帐内姜维代问：可否在帐外接报，由乙递入并由姜维处置。",
      "军情及时送达；接受许可由姜维决定；不同等价措辞有效，无需关键词或文采。"
    ],
    "forbiddenClaims": [
      "谎称旧轮许可在本轮有效",
      "命乙调兵、拘押魏延或将急报拖到明早",
      "宣称未来记忆证明敌军当前一定只是试探"
    ],
    "acceptanceCases": [
      {
        "when": {
          "all": [
            {
              "all": [
                {
                  "flag": "loop.player_alive",
                  "equals": true
                },
                {
                  "flag": "loop.result",
                  "equals": "none"
                }
              ]
            },
            {
              "all": [
                {
                  "flag": "memory.seen_execution",
                  "equals": true
                },
                {
                  "flag": "memory.knows_relay_tent",
                  "equals": true
                }
              ]
            },
            {
              "flag": "loop.route",
              "equals": "none"
            },
            {
              "flag": "loop.relay_agreed",
              "equals": false
            },
            {
              "flag": "loop.relay_location",
              "equals": "relay_tent"
            },
            {
              "evidence": "entry_notice",
              "mode": "presented"
            },
            {
              "evidence": "scout_statement",
              "mode": "presented"
            }
          ]
        },
        "outcome": {
          "reply": [
            {
              "id": "relay.contact.accepted",
              "speakerId": "relay",
              "text": "成，我替你问。准不准，得听姜将军的。你把要问的话定下来，我这就过去。",
              "effects": []
            }
          ],
          "effects": [
            {
              "type": "setFlag",
              "flag": "loop.relay_agreed",
              "value": true
            }
          ],
          "next": "relay.send_request"
        }
      }
    ]
  },
  {
    "id": "weiyan_wait",
    "acceptedIntentIds": [
      "propose_wait",
      "propose_handoff",
      "revise_plan"
    ],
    "requiredPoints": [
      "语义识别可靠且及时的替代传报方案；必须承认急报真实且不能拖延。",
      "无本轮许可时：以本轮禁入和军情为据，知道姜维在帐内，提出自己去帐门请求姜维接报，明确尚未获准。",
      "有本轮许可时：当面出示凭条及军情依据，安排乙到场接取、递入姜维，再取回话并转达；允许简洁等价表达，不强迫逐字背四步骤。",
      "重试保留已成立的理由，指出缺项；合理但未支持的新创意判 clarify 或 out_of_scope 并说明范围。"
    ],
    "forbiddenClaims": [
      "未来预言可直接替代眼前证据",
      "禁入等于急报无须处理",
      "旧轮凭条沿用，口称行动完成就视为完成",
      "拘押魏延、玩家自行调兵或延期急报"
    ],
    "acceptanceCases": [
      {
        "when": {
          "all": [
            {
              "all": [
                {
                  "all": [
                    {
                      "flag": "loop.player_alive",
                      "equals": true
                    },
                    {
                      "flag": "loop.result",
                      "equals": "none"
                    }
                  ]
                },
                {
                  "flag": "loop.weiyan_status",
                  "equals": "approaching"
                },
                {
                  "flag": "loop.route",
                  "equals": "none"
                }
              ]
            },
            {
              "flag": "loop.jiangwei_approval",
              "equals": true
            },
            {
              "evidence": "approval_note",
              "mode": "presented"
            },
            {
              "evidence": "scout_statement",
              "mode": "presented"
            }
          ]
        },
        "outcome": {
          "reply": [
            {
              "id": "weiyan.negotiate.authorized.accepted",
              "speakerId": "weiyan",
              "text": "准信我看过了。去把传令卒带来，我在候报处当面交代。快去！",
              "effects": []
            }
          ],
          "effects": [
            {
              "type": "setFlag",
              "flag": "loop.npc_weiyan_saw_approval",
              "value": true
            },
            {
              "type": "setFlag",
              "flag": "loop.route",
              "value": "authorized"
            },
            {
              "type": "setFlag",
              "flag": "loop.weiyan_status",
              "value": "waiting"
            },
            {
              "type": "startPromise",
              "promiseId": "authorized_handoff"
            }
          ],
          "next": null
        }
      },
      {
        "when": {
          "all": [
            {
              "all": [
                {
                  "all": [
                    {
                      "flag": "loop.player_alive",
                      "equals": true
                    },
                    {
                      "flag": "loop.result",
                      "equals": "none"
                    }
                  ]
                },
                {
                  "flag": "loop.weiyan_status",
                  "equals": "approaching"
                },
                {
                  "flag": "loop.route",
                  "equals": "none"
                }
              ]
            },
            {
              "flag": "loop.jiangwei_approval",
              "equals": false
            },
            {
              "flag": "loop.knows_jiangwei_inside",
              "equals": true
            },
            {
              "evidence": "guard_statement",
              "mode": "held"
            },
            {
              "evidence": "entry_notice",
              "mode": "presented"
            },
            {
              "evidence": "scout_statement",
              "mode": "presented"
            }
          ]
        },
        "outcome": {
          "reply": [
            {
              "id": "weiyan.negotiate.direct.accepted",
              "speakerId": "weiyan",
              "text": "好，你去请姜维，我在候报处等。你尚未得令，这一趟出了差池，自己担着！",
              "effects": []
            }
          ],
          "effects": [
            {
              "type": "setFlag",
              "flag": "loop.route",
              "value": "direct"
            },
            {
              "type": "setFlag",
              "flag": "loop.weiyan_status",
              "value": "waiting"
            },
            {
              "type": "startPromise",
              "promiseId": "direct_report"
            }
          ],
          "next": null
        }
      }
    ]
  }
];

export const actions: Action[] = [
  {
    "id": "relay.send_request",
    "title": "实际托乙向帐内姜维递话",
    "availableWhen": {
      "all": [
        {
          "all": [
            {
              "flag": "loop.player_alive",
              "equals": true
            },
            {
              "flag": "loop.result",
              "equals": "none"
            }
          ]
        },
        {
          "all": [
            {
              "flag": "memory.seen_execution",
              "equals": true
            },
            {
              "flag": "memory.knows_relay_tent",
              "equals": true
            }
          ]
        },
        {
          "flag": "loop.relay_agreed",
          "equals": true
        },
        {
          "flag": "loop.request_sent",
          "equals": false
        },
        {
          "flag": "loop.relay_location",
          "equals": "relay_tent"
        }
      ]
    },
    "timeCost": "none",
    "effects": [
      {
        "type": "setFlag",
        "flag": "loop.request_sent",
        "value": true
      }
    ],
    "next": "jiangwei.approval"
  },
  {
    "id": "report.handoff",
    "title": "实际交接军情并由乙递入",
    "availableWhen": {
      "all": [
        {
          "all": [
            {
              "all": [
                {
                  "flag": "loop.player_alive",
                  "equals": true
                },
                {
                  "flag": "loop.result",
                  "equals": "none"
                }
              ]
            },
            {
              "flag": "loop.weiyan_status",
              "equals": "waiting"
            }
          ]
        },
        {
          "flag": "loop.route",
          "equals": "authorized"
        },
        {
          "flag": "loop.jiangwei_approval",
          "equals": true
        },
        {
          "flag": "loop.relay_location",
          "equals": "waiting_area"
        },
        {
          "flag": "loop.report_status",
          "equals": "none"
        },
        {
          "evidence": "approval_note",
          "mode": "held"
        },
        {
          "evidence": "scout_statement",
          "mode": "held"
        }
      ]
    },
    "timeCost": "none",
    "effects": [
      {
        "type": "setFlag",
        "flag": "loop.report_status",
        "value": "delivered"
      }
    ],
    "next": null
  },
  {
    "id": "delay.unrelated_0",
    "title": "无关耗时行动：首次警告",
    "availableWhen": {
      "all": [
        {
          "all": [
            {
              "all": [
                {
                  "flag": "loop.player_alive",
                  "equals": true
                },
                {
                  "flag": "loop.result",
                  "equals": "none"
                }
              ]
            },
            {
              "flag": "loop.weiyan_status",
              "equals": "waiting"
            }
          ]
        },
        {
          "flag": "loop.delay_stage",
          "equals": 0
        }
      ]
    },
    "timeCost": "delay",
    "effects": [
      {
        "type": "setFlag",
        "flag": "loop.delay_stage",
        "value": 1
      }
    ],
    "next": null
  },
  {
    "id": "delay.unrelated_1",
    "title": "无关耗时行动：再次行动将破约",
    "availableWhen": {
      "all": [
        {
          "all": [
            {
              "all": [
                {
                  "flag": "loop.player_alive",
                  "equals": true
                },
                {
                  "flag": "loop.result",
                  "equals": "none"
                }
              ]
            },
            {
              "flag": "loop.weiyan_status",
              "equals": "waiting"
            }
          ]
        },
        {
          "flag": "loop.delay_stage",
          "equals": 1
        }
      ]
    },
    "timeCost": "delay",
    "effects": [
      {
        "type": "setFlag",
        "flag": "loop.delay_stage",
        "value": 2
      }
    ],
    "next": null
  }
];

export const promises: PromiseDefinition[] = [
  {
    "id": "authorized_handoff",
    "description": "按本轮有限许可，请乙到场、当面交报、取姜维回话、向魏延转达。",
    "requiredActionIds": [
      "relay.invite",
      "report.handoff",
      "report.receive_reply",
      "report.relay_reply"
    ],
    "completedWhen": {
      "all": [
        {
          "flag": "loop.route",
          "equals": "authorized"
        },
        {
          "flag": "loop.jiangwei_approval",
          "equals": true
        },
        {
          "flag": "loop.report_status",
          "equals": "relayed"
        },
        {
          "flag": "loop.unauthorized_reroute",
          "equals": false
        }
      ]
    },
    "delayBudget": 2,
    "brokenEffects": [
      {
        "type": "setFlag",
        "flag": "loop.weiyan_status",
        "value": "departed"
      },
      {
        "type": "setFlag",
        "flag": "loop.lamp_lit",
        "value": false
      }
    ]
  }
];

export const events: EventRule[] = [
  {
    "id": "event.lamp_failure",
    "priority": 300,
    "when": {
      "all": [
        {
          "flag": "loop.result",
          "equals": "none"
        },
        {
          "flag": "loop.lamp_lit",
          "equals": false
        }
      ]
    },
    "effects": [
      {
        "type": "setFlag",
        "flag": "loop.result",
        "value": "lamp_failure"
      }
    ],
    "next": "ending.lamp_failure"
  },
  {
    "id": "event.direct_execution",
    "priority": 200,
    "when": {
      "all": [
        {
          "flag": "loop.result",
          "equals": "none"
        },
        {
          "flag": "loop.route",
          "equals": "direct"
        },
        {
          "flag": "loop.unauthorized_reroute",
          "equals": true
        },
        {
          "flag": "loop.report_status",
          "equals": "delivered"
        },
        {
          "flag": "loop.lamp_lit",
          "equals": true
        }
      ]
    },
    "effects": [
      {
        "type": "setFlag",
        "flag": "loop.result",
        "value": "execution"
      },
      {
        "type": "setFlag",
        "flag": "loop.weiyan_status",
        "value": "departed"
      }
    ],
    "next": "ending.execution"
  },
  {
    "id": "event.safe",
    "priority": 100,
    "when": {
      "all": [
        {
          "flag": "loop.result",
          "equals": "none"
        },
        {
          "flag": "loop.route",
          "equals": "authorized"
        },
        {
          "flag": "loop.jiangwei_approval",
          "equals": true
        },
        {
          "flag": "loop.npc_weiyan_saw_approval",
          "equals": true
        },
        {
          "flag": "loop.report_status",
          "equals": "relayed"
        },
        {
          "flag": "loop.unauthorized_reroute",
          "equals": false
        },
        {
          "flag": "loop.lamp_lit",
          "equals": true
        },
        {
          "flag": "loop.player_alive",
          "equals": true
        }
      ]
    },
    "effects": [
      {
        "type": "setFlag",
        "flag": "loop.result",
        "value": "safe"
      }
    ],
    "next": "ending.safe"
  }
];
