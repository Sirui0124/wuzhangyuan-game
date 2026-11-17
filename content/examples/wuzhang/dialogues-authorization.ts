import type { DialogueNode } from '../../schema/narrative';

export const authorizationDialogues: DialogueNode[] = [
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
  }
];
