import type {
  Debt,
  DebtDeduction,
  RewardSettlement,
} from "@/shared/domain";
import { SCAR_HP, SHOP_DEBT_SURCHARGE } from "@/shared/economy";

// 常量从 shared/economy 统一来源，这里再转出以维持既有调用方的导入路径
export { SCAR_HP, SHOP_DEBT_SURCHARGE };

export function activeDebts(debts: readonly Debt[]): Debt[] {
  return debts
    .filter((d) => d.active)
    // 偿还顺序在签约时由 order 锁定，绝不因后续好感等因素重排
    .slice()
    .sort((a, b) => a.order - b.order);
}

export function hasActiveDebt(debts: readonly Debt[]): boolean {
  return debts.some((d) => d.active);
}

export function remainingDebt(d: Debt): number {
  return Math.max(0, d.principal - d.repaid);
}

export function totalOutstanding(debts: readonly Debt[]): number {
  return activeDebts(debts).reduce((sum, d) => sum + remainingDebt(d), 0);
}

// 欠债期间商店加价：在好感/稀缺定价之后再叠加固定附加费
export function applyDebtSurcharge(price: number, inDebt: boolean): number {
  return inDebt ? price + SHOP_DEBT_SURCHARGE : price;
}

// 单场胜利中某笔债务的约定扣款额（锁定本金的均分，余数计入最后一期）
function installmentAmount(d: Debt): number {
  const left = remainingDebt(d);
  const periodsLeft = Math.max(1, d.installments - d.paymentsTaken);
  return Math.min(left, Math.ceil(left / periodsLeft));
}

/**
 * 依据锁定的债务条款，对一场战斗胜利的原始金币奖励进行扣款。
 * 严格按 order 顺序逐笔偿还；金币不足时保留未偿债务，不提前清除后果。
 * 纯函数：不修改入参，返回结算账目与新的债务数组，便于先预览后提交。
 */
export function settleBattleReward(
  grossGold: number,
  heal: number,
  debts: readonly Debt[],
): { settlement: RewardSettlement; nextDebts: Debt[] } {
  const next = debts.map((d) => ({ ...d }));
  const deductions: DebtDeduction[] = [];
  let available = grossGold;

  for (const d of activeDebts(next)) {
    if (d.trigger !== "battle") continue;
    if (available <= 0) break;
    const want = installmentAmount(d);
    const pay = Math.min(want, available, remainingDebt(d));
    if (pay <= 0) continue;
    d.repaid += pay;
    d.paymentsTaken += 1;
    available -= pay;
    const cleared = remainingDebt(d) === 0;
    if (cleared) d.active = false;
    deductions.push({
      debtId: d.id,
      label: d.originTitle,
      amount: pay,
      cleared,
    });
  }

  const totalDeducted = grossGold - available;
  const unpaidDebt = totalOutstanding(next);
  return {
    settlement: {
      grossGold,
      deductions,
      totalDeducted,
      netGold: available,
      unpaidDebt,
      heal,
    },
    nextDebts: next,
  };
}

/**
 * 到期处理：在进入/经过约定深度时检查。
 * 仍未清偿的债务执行签约时展示的惩罚，并将该笔债务标记为已结清（后果已兑现）。
 * 金币惩罚优先扣金币，不足部分不产生新债；伤疤直接计入。
 * 返回新的债务数组、累计伤疤数与实际扣减金币。
 */
export function applyDuePenalties(
  debts: readonly Debt[],
  currentDepth: number,
  gold: number,
): { nextDebts: Debt[]; scars: number; goldLost: number } {
  const next = debts.map((d) => ({ ...d }));
  let scars = 0;
  let goldLost = 0;

  for (const d of next) {
    if (!d.active || d.penaltyApplied) continue;
    if (currentDepth < d.dueDepth) continue;
    d.penaltyApplied = true;
    d.active = false; // 惩罚兑现后，未来后果解除，不再扣款或加价
    if (d.penalty.type === "scar") {
      scars += d.penalty.amount;
    } else {
      const take = Math.min(gold - goldLost, d.penalty.amount);
      goldLost += Math.max(0, take);
    }
  }
  return { nextDebts: next, scars, goldLost };
}

// 路线图上需要标注的债务到期深度（去重、升序）
export function dueDepths(debts: readonly Debt[]): number[] {
  return Array.from(
    new Set(
      debts
        .filter((d) => d.active && !d.penaltyApplied)
        .map((d) => d.dueDepth),
    ),
  ).sort((a, b) => a - b);
}

// 某深度上到期的债务（用于节点标记）
export function debtsDueAt(debts: readonly Debt[], depth: number): Debt[] {
  return debts.filter(
    (d) => d.active && !d.penaltyApplied && d.dueDepth === depth,
  );
}

export function debtSummaryLine(d: Debt): string {
  return `${d.originTitle} · 欠 ${remainingDebt(d)} / ${d.principal} 金 · 第 ${d.dueDepth + 1} 层到期`;
}
