import type { PromiseDefinition } from '../../schema/narrative';

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
