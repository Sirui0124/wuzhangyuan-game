import type { DialogueNode } from '../../schema/narrative';

export const investigationDialogues: DialogueNode[] = [
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
  }
];
