import type { Action } from '../../schema/narrative';

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
