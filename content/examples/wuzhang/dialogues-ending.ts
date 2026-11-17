import type { DialogueNode } from '../../schema/narrative';

export const endingDialogues: DialogueNode[] = [
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
