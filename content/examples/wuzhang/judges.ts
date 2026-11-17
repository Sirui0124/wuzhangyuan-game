import type { JudgeDefinition } from '../../schema/narrative';

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
