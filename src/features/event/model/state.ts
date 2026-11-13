import { reactive, readonly } from "vue";
import type {
  ActiveEncounter,
  Debt,
  EventOption,
  RewardSettlement,
} from "@/shared/domain";
import { uid } from "@/shared/random";
import { encounterById, encounterForNode } from "../lib/encounters";
import {
  activeDebts,
  applyDuePenalties,
  settleBattleReward,
  totalOutstanding,
} from "../lib/debts";

export interface PreviewCost {
  ok: boolean;
  reason?: string;
  immediate: string[]; // 即时损益
  future: string[]; // 未来到期条件
}

interface EventState {
  active: ActiveEncounter | null;
  debts: Debt[];
  // 预支下一场奖励：单笔待抵扣金额，由下一场战斗胜利结算时消费
  pendingAdvance: number;
  advanceOrigin: string | null;
  nextOrder: number;
  // 已完成结算的战斗 id，防止重复领奖/重复扣款
  settledBattles: string[];
  lastSettlement: RewardSettlement | null;
}

const state = reactive<EventState>({
  active: null,
  debts: [],
  pendingAdvance: 0,
  advanceOrigin: null,
  nextOrder: 0,
  settledBattles: [],
  lastSettlement: null,
});

export const eventState = readonly(state);

export function openEncounter(nodeId: string): ActiveEncounter | null {
  const def = encounterForNode(nodeId);
  if (!def) return null;
  state.active = {
    nodeId,
    defId: def.id,
    resolved: false,
    chosenOptionId: null,
  };
  return state.active;
}

export function activeEncounter() {
  if (!state.active) return null;
  return encounterById(state.active.defId) ?? null;
}

export function findOption(optionId: string): EventOption | null {
  const def = activeEncounter();
  return def?.options.find((o) => o.id === optionId) ?? null;
}

function countCardKey(deckKeys: string[], key?: string) {
  return key ? deckKeys.filter((k) => k === key).length : 0;
}

/**
 * 选择前的预览：只做校验与文案构建，绝不扣除任何卡牌或金币。
 * deckKeys 为当前牌组的卡牌 key 列表，gold 为当前金币。
 */
export function previewOption(
  optionId: string,
  deckKeys: string[],
  gold: number,
): PreviewCost | null {
  const option = findOption(optionId);
  if (!option || !state.active || state.active.resolved) return null;
  const immediate: string[] = [];
  const future: string[] = [];
  let ok = true;
  let reason: string | undefined;

  if (option.gain.gold) immediate.push(`立即 +${option.gain.gold} 金币`);
  if (option.gain.heal) immediate.push(`立即回复 ${option.gain.heal} 生命`);
  if (option.gain.card) immediate.push(`获得卡牌 1 张`);

  if (option.costType === "card") {
    const own = countCardKey(deckKeys, option.cardKey);
    if (own < 1) {
      ok = false;
      reason = "牌组中没有可交付的指定卡牌";
    } else {
      immediate.unshift(`确认后移除 1 张指定卡牌`);
    }
  } else if (option.costType === "advance") {
    immediate.unshift(`立即预支 ${option.advanceGold} 金币`);
    future.push(`下一场战斗胜利的金币奖励将被全额抵扣（最多抵扣 ${option.advanceGold} 金）`);
  } else if (option.costType === "debt" && option.debt) {
    const d = option.debt;
    immediate.unshift(`立即借得 ${d.principal} 金币`);
    const per = Math.ceil(d.principal / d.installments);
    future.push(`锁定债务 ${d.principal} 金，分 ${d.installments} 场胜利偿还（每期约 ${per} 金）`);
    future.push(`第 ${d.dueDepth + 1} 层前到期，逾期：${d.penalty.label}`);
    future.push("欠债期间商店每件商品额外加价 8 金");
    if (gold < 0) {
      ok = false;
      reason = "金币状态异常";
    }
  }

  return { ok, reason, immediate, future };
}

export interface CommitResult {
  ok: boolean;
  reason?: string;
  goldGain: number;
  heal: number;
  card?: string;
  removeCardKey?: string;
  debt?: Debt;
  advance?: { nodeId: string; amount: number };
}

/**
 * 确认签约：在此统一扣除卡牌/金币后果。
 * 债务数额与偿还顺序在此刻锁定，之后好感折扣无法改写。
 * 返回需要由命令层应用到牌组/英雄的具体变动，避免跨模块直接改状态。
 */
export function commitOption(optionId: string): CommitResult {
  const option = findOption(optionId);
  if (!option || !state.active || state.active.resolved) {
    return { ok: false, reason: "该遭遇已经处理或不可用", goldGain: 0, heal: 0 };
  }

  const result: CommitResult = {
    ok: true,
    goldGain: option.gain.gold ?? 0,
    heal: option.gain.heal ?? 0,
    card: option.gain.card,
  };

  if (option.costType === "card") {
    result.removeCardKey = option.cardKey;
  } else if (option.costType === "advance") {
    const amount = option.advanceGold ?? 0;
    // 预支锁定为待抵扣金额，由下一场战斗胜利的奖励结算消费
    state.pendingAdvance = amount;
    state.advanceOrigin = state.active.nodeId;
    result.advance = { nodeId: state.active.nodeId, amount };
  } else if (option.costType === "debt" && option.debt) {
    const d = option.debt;
    const debt: Debt = {
      id: uid("debt"),
      originNodeId: state.active.nodeId,
      originTitle: encounterById(state.active.defId)?.title ?? "债务契约",
      principal: d.principal, // 锁定本金
      repaid: 0,
      order: state.nextOrder++, // 锁定偿还顺序
      trigger: d.trigger,
      dueDepth: d.dueDepth,
      installments: d.installments,
      paymentsTaken: 0,
      active: true,
      penaltyApplied: false,
      penalty: { ...d.penalty },
    };
    state.debts.push(debt);
    result.debt = debt;
  }

  state.active.resolved = true;
  state.active.chosenOptionId = optionId;
  return result;
}

export function closeEncounter() {
  state.active = null;
}

// 是否存在尚未抵扣的预支
export function hasAdvance(): boolean {
  return state.pendingAdvance > 0;
}

// 当前待抵扣的预支金额（用于界面提示）
export function pendingAdvanceAmount(): number {
  return state.pendingAdvance;
}

/**
 * 战斗胜利奖励结算（含预支抵扣 + 债务扣款），只读预览。
 * 在命令层打开奖励页时调用；不修改债务或预支状态。
 */
export function previewBattleSettlement(
  _battleId: string,
  grossGold: number,
  heal: number,
): RewardSettlement {
  // 1) 预支下一场奖励优先抵扣；本场奖励不足时剩余预支顺延到再下一场
  const advance = state.pendingAdvance;
  const advanceDeducted = Math.min(advance, grossGold);
  const afterAdvance = grossGold - advanceDeducted;

  // 2) 债务按锁定顺序扣款（纯函数，不落盘）
  const { settlement } = settleBattleReward(afterAdvance, heal, state.debts);

  return {
    grossGold,
    deductions: [
      ...(advanceDeducted > 0
        ? [
            {
              debtId: "pending-advance",
              label:
                advance > grossGold
                  ? `预支奖励抵扣（剩余 ${advance - grossGold} 金顺延）`
                  : "预支奖励抵扣",
              amount: advanceDeducted,
              cleared: advance <= grossGold,
            },
          ]
        : []),
      ...settlement.deductions,
    ],
    totalDeducted: advanceDeducted + settlement.totalDeducted,
    netGold: grossGold - advanceDeducted - settlement.totalDeducted,
    unpaidDebt: settlement.unpaidDebt,
    heal,
  };
}

// 确认领奖时真正提交：写入债务变动、消费预支，并记录幂等键。
export function commitBattleSettlement(
  battleId: string,
  grossGold: number,
  heal: number,
): RewardSettlement | null {
  if (state.settledBattles.includes(battleId)) {
    return state.lastSettlement;
  }
  const advance = state.pendingAdvance;
  const advanceDeducted = Math.min(advance, grossGold);
  // 不足抵扣的预支顺延，避免提前清除已承诺代价
  state.pendingAdvance = advance - advanceDeducted;
  if (state.pendingAdvance === 0) state.advanceOrigin = null;
  const afterAdvance = grossGold - advanceDeducted;

  const { settlement, nextDebts } = settleBattleReward(
    afterAdvance,
    heal,
    state.debts,
  );
  state.debts = nextDebts;

  const merged: RewardSettlement = {
    grossGold,
    deductions: [
      ...(advanceDeducted > 0
        ? [
            {
              debtId: "pending-advance",
              label:
                advance > grossGold
                  ? `预支奖励抵扣（剩余 ${advance - grossGold} 金顺延）`
                  : "预支奖励抵扣",
              amount: advanceDeducted,
              cleared: advance <= grossGold,
            },
          ]
        : []),
      ...settlement.deductions,
    ],
    totalDeducted: advanceDeducted + settlement.totalDeducted,
    netGold: grossGold - advanceDeducted - settlement.totalDeducted,
    unpaidDebt: settlement.unpaidDebt,
    heal,
  };

  state.settledBattles.push(battleId);
  state.lastSettlement = merged;
  return merged;
}

/**
 * 进入节点时处理债务到期。返回伤疤与金币损失，由命令层应用到英雄。
 * 金币不足时保留未偿债务逻辑由惩罚条款决定（伤疤不依赖金币）。
 */
export function processNodeEntry(depth: number, gold: number) {
  const { nextDebts, scars, goldLost } = applyDuePenalties(
    state.debts,
    depth,
    gold,
  );
  state.debts = nextDebts;
  return { scars, goldLost };
}

export function outstandingTotal() {
  return totalOutstanding(state.debts);
}

export function activeDebtList(): Debt[] {
  return activeDebts(state.debts);
}

export function exportEvent() {
  return JSON.parse(
    JSON.stringify({
      active: state.active,
      debts: state.debts,
      pendingAdvance: state.pendingAdvance,
      advanceOrigin: state.advanceOrigin,
      nextOrder: state.nextOrder,
      settledBattles: state.settledBattles,
      lastSettlement: state.lastSettlement,
    }),
  );
}

export function restoreEvent(d: ReturnType<typeof exportEvent>) {
  state.active = d.active ?? null;
  state.debts = d.debts ?? [];
  // 兼容旧存档里按节点存储的 advances 结构
  const legacy = (d as { advances?: Record<string, number> }).advances;
  const legacyTotal = legacy
    ? Object.values(legacy).reduce((s, v) => s + v, 0)
    : 0;
  state.pendingAdvance = d.pendingAdvance ?? legacyTotal;
  state.advanceOrigin = d.advanceOrigin ?? null;
  state.nextOrder = d.nextOrder ?? state.debts.length;
  state.settledBattles = d.settledBattles ?? [];
  state.lastSettlement = d.lastSettlement ?? null;
}

export function resetEvent() {
  state.active = null;
  state.debts = [];
  state.pendingAdvance = 0;
  state.advanceOrigin = null;
  state.nextOrder = 0;
  state.settledBattles = [];
  state.lastSettlement = null;
}
