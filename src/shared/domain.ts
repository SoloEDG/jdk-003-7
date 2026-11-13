export type Region = "forest" | "forge" | "abyss";
export type NodeKind = "battle" | "elite" | "shop" | "camp" | "event" | "boss";
export interface Influence {
  heat: number;
  favor: number;
  scarcity: number;
}
export interface RouteNode {
  id: string;
  region: Region;
  depth: number;
  lane: number;
  kind: NodeKind;
  title: string;
  influence: Influence;
  next: string[];
}
export interface CardInstance {
  id: string;
  key: string;
  upgraded: boolean;
}
export interface CardSpec {
  key: string;
  name: string;
  cost: number;
  kind: "attack" | "skill" | "power";
  text: string;
  rarity: "common" | "rare";
  effects: Effect[];
}
export type Effect = {
  type: "damage" | "block" | "draw" | "poison" | "strength" | "heal" | "energy";
  amount: number;
  target: "hero" | "enemy";
};
export interface Actor {
  hp: number;
  maxHp: number;
  block: number;
  strength: number;
  poison: number;
  thorns: number;
}
export interface JourneyContext {
  nodeId: string;
  region: Region;
  depth: number;
  kind: NodeKind;
  influence: Influence;
}
export interface BattleResult {
  id: string;
  nodeId: string;
  won: boolean;
  hp: number;
  gold: number;
  context: JourneyContext;
}
export interface RewardOffer {
  id: string;
  source: string;
  cards: string[];
  gold: number;
  heal: number;
  claimed: boolean;
  // 债务结算快照：展示与实际扣款共用同一份锁定数据
  breakdown: RewardSettlement | null;
}
// 一场战斗胜利奖励在债务扣款前后的完整账目
export interface RewardSettlement {
  grossGold: number;
  deductions: DebtDeduction[];
  totalDeducted: number;
  netGold: number;
  unpaidDebt: number;
  heal: number;
}
export interface DebtDeduction {
  debtId: string;
  label: string;
  amount: number;
  cleared: boolean;
}
export interface Purchase {
  id: string;
  card: string;
  price: number;
}
// 债务的偿还触发方式
export type DebtTrigger = "battle" | "shop";
// 签约时锁定的债务条款。锁定后任何好感/稀缺变化都不能改写承诺代价。
export interface Debt {
  id: string;
  originNodeId: string;
  originTitle: string;
  principal: number; // 锁定的债务总额（金币）
  repaid: number; // 已偿还金币
  // 固定偿还顺序：按顺序逐笔扣款，先入约者先清偿
  order: number;
  trigger: DebtTrigger;
  // 到期节点（路线深度）；到该深度仍未还清则触发惩罚
  dueDepth: number;
  installments: number; // 约定分几场胜利偿还
  paymentsTaken: number; // 已从几场胜利中扣款
  active: boolean; // 未完全清偿且未被惩罚结算
  penaltyApplied: boolean;
  penalty: DebtPenalty;
}
export interface DebtPenalty {
  type: "scar" | "gold";
  amount: number;
  label: string;
}
// 事件选项要求交付的精确代价
export type EventCostType = "card" | "advance" | "debt";
export interface EventOption {
  id: string;
  label: string;
  detail: string;
  costType: EventCostType;
  // 交付某张精确卡牌（按卡牌 key，且必须实际拥有该 key 的一张实例）
  cardKey?: string;
  // 预支下一场奖励：立即到手的金币
  advanceGold?: number;
  // 欠债：锁定本金、偿还场数与到期深度
  debt?: {
    principal: number;
    installments: number;
    dueDepth: number;
    trigger: DebtTrigger;
    penalty: DebtPenalty;
  };
  // 即时收益
  gain: { gold?: number; heal?: number; card?: string };
}
export interface EncounterDef {
  id: string;
  title: string;
  intro: string;
  options: EventOption[];
}
export interface ActiveEncounter {
  nodeId: string;
  defId: string;
  resolved: boolean;
  chosenOptionId: string | null;
}
export interface ExpeditionSummary {
  hp: number;
  maxHp: number;
  gold: number;
  scars: number;
}
export const regionNames: Record<Region, string> = {
  forest: "苔光林地",
  forge: "熔铁边境",
  abyss: "无声深渊",
};
