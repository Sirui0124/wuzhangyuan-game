import type { EventRule } from '../../schema/narrative';

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
