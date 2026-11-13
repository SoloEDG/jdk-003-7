import { reactive, readonly } from "vue";
import type {
  BattleResult,
  RewardOffer,
  RewardSettlement,
} from "@/shared/domain";
import { offerFrom, validChoice } from "../lib/settlement";
const state = reactive({
  offer: null as RewardOffer | null,
  history: [] as string[],
  selected: "",
});
export const rewardState = readonly(state);
export function openReward(
  result: BattleResult,
  settlement: RewardSettlement | null,
) {
  if (!result.won || state.history.includes(result.id)) return false;
  state.offer = offerFrom(result, settlement);
  state.selected = "";
  return true;
}
export function chooseReward(key: string) {
  if (state.offer?.cards.includes(key)) state.selected = key;
}
export function claimReward(skip = false) {
  if (!validChoice(state.offer, skip ? null : state.selected)) return null;
  const offer = state.offer!;
  offer.claimed = true;
  state.history.push(offer.source);
  // 若存在债务/预支结算，实际金币以锁定账目的净额为准，避免重复或漏扣
  const gold = offer.breakdown ? offer.breakdown.netGold : offer.gold;
  return {
    card: skip ? null : state.selected,
    gold,
    heal: offer.heal,
    breakdown: offer.breakdown,
  };
}
export function exportReward() {
  return JSON.parse(
    JSON.stringify({ offer: state.offer, history: state.history }),
  );
}
export function restoreReward(d: ReturnType<typeof exportReward>) {
  state.offer = d.offer;
  state.history = d.history;
  state.selected = "";
}
export function resetReward() {
  state.offer = null;
  state.history = [];
  state.selected = "";
}
