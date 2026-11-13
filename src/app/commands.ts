import { enterRoute, resolveRoute, resetRoute } from "@/features/route";
import {
  battleState,
  beginBattle,
  playCard,
  endTurn,
  resetBattle,
} from "@/features/battle";
import {
  deckState,
  deckCards,
  addCard,
  earnGold,
  spendGold,
  setHp,
  heal,
  upgradeCard,
  removeCard,
  removeCardByKey,
  addScar,
  openCamp,
  useCamp,
  resetDeck,
} from "@/features/deck";
import {
  openReward,
  claimReward,
  resetReward,
} from "@/features/reward";
import {
  openShop,
  preparePurchase,
  completePurchase,
  closeShop,
  resetShop,
} from "@/features/shop";
import {
  openEncounter,
  activeEncounter,
  commitOption,
  closeEncounter,
  previewBattleSettlement,
  commitBattleSettlement,
  processNodeEntry,
  hasActiveDebt,
  eventState,
  resetEvent,
} from "@/features/event";
import {
  session,
  switchTab,
  setContext,
  notify,
  finishRun,
  resetSession,
} from "./session";
import { save, clearSave } from "./persistence";

function persist() {
  if (!save()) notify("本地保存失败，请保留当前页面。");
}

// 进入节点时统一处理债务到期（惩罚在此时按锁定条款兑现）
function handleDueDebts(depth: number) {
  const { scars, goldLost } = processNodeEntry(depth, deckState.hero.gold);
  if (goldLost > 0 && !spendGold(goldLost)) {
    // 金币惩罚在不足时只扣到 0，不产生新债
    spendGold(deckState.hero.gold);
  }
  if (scars > 0) {
    addScar(scars);
    notify(`债务到期未偿，惩罚已兑现：${scars} 道伤疤（最大生命 -${scars * 8}）。`);
  }}

export function navigate(id: string) {
  if (session.ended) return;
  const c = enterRoute(id);
  if (!c) return;
  setContext(c);

  // 先结算上一层延续到此的到期债务
  handleDueDebts(c.depth);

  if (c.kind === "shop") {
    openShop(c);
    switchTab("shop");
  } else if (c.kind === "camp") {
    openCamp();
    switchTab("deck");
  } else if (c.kind === "event") {
    openEncounter(c.nodeId);
    switchTab("event");
  } else {
    beginBattle(c, deckCards(), deckState.hero.hp, deckState.hero.maxHp);
    switchTab("battle");
  }
  notify(
    `进入 ${c.nodeId} · 威胁 ${c.influence.heat} / 好感 ${c.influence.favor}`,
  );
  persist();
}

export function play(id: string) {
  playCard(id);
  persist();
}
export function turn() {
  endTurn();
  persist();
}

export function settle() {
  const r = battleState.result;
  if (!r) return;
  if (!r.won) {
    setHp(r.hp);
    finishRun();
    notify("这次旅途已经结束。重新启程可保留你的经验。");
    persist();
    return;
  }
  // 依据锁定的债务与预支条款生成结算账目（只读预览，尚未扣款）
  const grossGold = r.gold + r.context.influence.favor * 2;
  const healAmount = r.context.region === "forest" ? 3 : 0;
  const settlement = previewBattleSettlement(r.id, grossGold, healAmount);
  if (openReward(JSON.parse(JSON.stringify(r)), settlement)) {
    setHp(r.hp);
    switchTab("reward");
    notify("胜利！选择一张牌或跳过卡牌，金币都会按债务账目结算。");
  }
  persist();
}

export function claim(skip: boolean) {
  const grant = claimReward(skip);
  if (!grant) return;
  const r = battleState.result;
  // 确认领奖时才真正提交债务扣款与预支抵扣；幂等，重复调用不会重复扣款
  if (r) {
    commitBattleSettlement(
      r.id,
      grant.breakdown ? grant.breakdown.grossGold : grant.gold,
      grant.heal,
    );
  }
  if (grant.card) addCard(grant.card);
  // grant.gold 已是净额（含债务/预支扣款），只发放实际所得
  earnGold(grant.gold);
  heal(grant.heal);
  resolveRoute();
  if (session.context?.kind === "boss") {
    finishRun();
    notify("裂隙已被封存。你把余烬带回了黎明。");
  } else if (grant.breakdown && grant.breakdown.totalDeducted > 0) {
    notify(
      `战利品已结算：原奖励 ${grant.breakdown.grossGold} 金，扣款 ${grant.breakdown.totalDeducted} 金，实得 ${grant.breakdown.netGold} 金。`,
    );
  } else notify("奖励已结算，新的路线开放。");
  switchTab("route");
  persist();
}

export function buy(id: string) {
  const inDebt = hasActiveDebt(eventState.debts);
  const p = preparePurchase(id, inDebt);
  if (!p || !spendGold(p.price)) {
    notify("无法购买：库存或金币不足。");
    return;
  }
  if (!completePurchase(p)) {
    earnGold(p.price);
    return;
  }
  addCard(p.card);
  notify("交易完成，卡牌已收入牌组。");
  persist();
}
export function leaveShop() {
  closeShop();
  resolveRoute();
  switchTab("route");
  persist();
}

// 确认遭遇选项：在此统一扣除卡牌/金币后果并锁定债务
export function confirmEvent(optionId: string) {
  const result = commitOption(optionId);
  if (!result.ok) {
    notify(result.reason ?? "无法执行该选择。");
    return;
  }
  if (result.removeCardKey) {
    const removed = removeCardByKey(result.removeCardKey);
    if (!removed) {
      notify("交付失败：指定卡牌已不在牌组中。");
      return;
    }
  }
  if (result.goldGain) earnGold(result.goldGain);
  if (result.heal) heal(result.heal);
  if (result.card) addCard(result.card);
  if (result.debt) {
    notify(
      `债务已成立：锁定 ${result.debt.principal} 金，偿还顺序与到期节点已固定，好感折扣无法改写。`,
    );
  } else if (result.advance) {
    notify(`已预支 ${result.advance.amount} 金，将抵扣下一场战斗胜利的奖励。`);
  } else {
    notify("契约已成，代价已经结算。");
  }
  persist();
}

export function leaveEvent() {
  const encounter = activeEncounter();
  closeEncounter();
  resolveRoute();
  switchTab("route");
  if (encounter) notify("你转身离开，路线继续向前。");
  persist();
}

export function camp(action: "rest" | "upgrade") {
  if (
    !session.context ||
    session.context.kind !== "camp" ||
    !useCamp(action, session.context.influence.heat)
  )
    return;
  resolveRoute();
  notify("篝火逐渐熄灭，你准备好继续上路。");
  persist();
}
export function upgrade(id: string) {
  if (battleState.phase === "playing") return;
  notify(upgradeCard(id) ? "卡牌强化完成。" : "无法强化：金币不足或已经强化。");
  persist();
}
export function remove(id: string) {
  if (battleState.phase === "playing") return;
  notify(
    removeCard(id)
      ? "已移除卡牌。"
      : "无法移除：至少保留五张牌，且需要足够金币。",
  );
  persist();
}
export function restart() {
  resetRoute();
  resetBattle();
  resetDeck();
  resetReward();
  resetShop();
  resetEvent();
  resetSession();
  clearSave();
  persist();
}
