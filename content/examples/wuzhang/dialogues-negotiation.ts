import type { DialogueNode } from '../../schema/narrative';

export const negotiationDialogues: DialogueNode[] = [
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
  }
];
