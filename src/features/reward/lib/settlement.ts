import type {
  BattleResult,
  RewardOffer,
  RewardSettlement,
} from "@/shared/domain";
import { rewardPool } from "./pool";
export function offerFrom(
  result: BattleResult,
  settlement: RewardSettlement | null,
): RewardOffer {
  const baseGold = result.gold + result.context.influence.favor * 2;
  return {
    id: `reward-${result.id}`,
    source: result.id,
    cards: rewardPool(result.context),
    // gold 保存原始奖励；实际所得以 breakdown.netGold 为准
    gold: baseGold,
    heal: result.context.region === "forest" ? 3 : 0,
    claimed: false,
    breakdown: settlement,
  };
}
export function validChoice(offer: RewardOffer | null, key: string | null) {
  return (
    !!offer && !offer.claimed && (key === null || offer.cards.includes(key))
  );
}
