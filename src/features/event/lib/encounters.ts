import type { EncounterDef } from "@/shared/domain";
import { hash } from "@/shared/random";

// 路线上可重复出现的遭遇事件。每个选项的代价都可在确认前精确预览。
const ENCOUNTERS: EncounterDef[] = [
  {
    id: "pact-of-embers",
    title: "余烬契约",
    intro:
      "兜帽商人在熄灭的祭坛前摊开一纸契约：立刻取用金币，代价会在接下来几场胜利中逐笔收回。",
    options: [
      {
        id: "surrender-card",
        label: "交付精确卡牌",
        detail: "交出一张「余烬斩」，换取立即金币与疗愈。卡牌在确认后才移除。",
        costType: "card",
        cardKey: "strike",
        gain: { gold: 35, heal: 8 },
      },
      {
        id: "advance-reward",
        label: "预支下一场奖励",
        detail: "立即拿走 30 金币，下一场战斗胜利的战利品将被全额抵扣。",
        costType: "advance",
        advanceGold: 30,
        gain: { gold: 30 },
      },
      {
        id: "merchant-debt",
        label: "向商人借债",
        detail:
          "立即获得 45 金币。债务分 3 场战斗胜利偿还，第 5 层前到期；期间商店加价，到期未偿将留下伤疤。",
        costType: "debt",
        gain: { gold: 45 },
        debt: {
          principal: 45,
          installments: 3,
          dueDepth: 5,
          trigger: "battle",
          penalty: { type: "scar", amount: 1, label: "留下 1 道伤疤（最大生命 -8）" },
        },
      },
    ],
  },
  {
    id: "the-menders-deal",
    title: "修补匠的交易",
    intro:
      "修补匠愿意当场加固你的火种，但她收取的代价会沿着旅途持续回响。",
    options: [
      {
        id: "give-guard",
        label: "交付精确卡牌",
        detail: "交出一张「铁叶护身」，换取疗愈与一枚金币。",
        costType: "card",
        cardKey: "guard",
        gain: { gold: 20, heal: 12 },
      },
      {
        id: "small-debt",
        label: "小额借债",
        detail:
          "立即获得 30 金币，分 2 场胜利偿还，第 4 层前到期；逾期失去 15 金币并留下伤疤。",
        costType: "debt",
        gain: { gold: 30 },
        debt: {
          principal: 30,
          installments: 2,
          dueDepth: 4,
          trigger: "battle",
          penalty: { type: "scar", amount: 1, label: "留下 1 道伤疤（最大生命 -8）" },
        },
      },
      {
        id: "advance-small",
        label: "预支下一场奖励",
        detail: "立即拿走 22 金币，抵扣下一场战斗的全部战利品。",
        costType: "advance",
        advanceGold: 22,
        gain: { gold: 22 },
      },
    ],
  },
];

export function encounterForNode(nodeId: string): EncounterDef {
  return ENCOUNTERS[hash(nodeId) % ENCOUNTERS.length]!;
}

export function encounterById(id: string): EncounterDef | undefined {
  return ENCOUNTERS.find((e) => e.id === id);
}
