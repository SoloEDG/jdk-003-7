<script setup lang="ts">
import { rewardState, chooseReward } from "../model/state";
import { cards } from "@/shared/cards";
defineEmits<{ claim: [skip: boolean] }>();
</script>
<template>
  <section class="panel">
    <div class="section-top">
      <span class="eyebrow">03 / THE SPOILS</span><span>三选一</span>
    </div>
    <h2>把胜利带进下一场</h2>
    <p class="muted">
      战斗结束后结算金币，并选择一张新牌。债务扣款与预支抵扣会在战利品中逐笔列出。
    </p>
    <div v-if="rewardState.offer && !rewardState.offer.claimed">
      <!-- 奖励账目：原奖励 → 扣款 → 实际所得 -->
      <div class="notice settlement" v-if="rewardState.offer.breakdown">
        <div class="settle-row gross">
          <span>原奖励金币</span>
          <b>{{ rewardState.offer.breakdown.grossGold }} 金</b>
        </div>
        <div
          v-for="(d, i) in rewardState.offer.breakdown.deductions"
          :key="i"
          class="settle-row deduct"
        >
          <span>－ {{ d.label }}<em v-if="d.cleared"> · 已结清</em></span>
          <b>-{{ d.amount }} 金</b>
        </div>
        <div class="settle-row net">
          <span>实际所得</span>
          <b>{{ rewardState.offer.breakdown.netGold }} 金</b>
        </div>
        <div v-if="rewardState.offer.breakdown.unpaidDebt > 0" class="unpaid">
          ⚠ 金币不足，仍有
          {{ rewardState.offer.breakdown.unpaidDebt }}
          金未偿债务，将延续到后续胜利并保留到期惩罚。
        </div>
        <div v-if="rewardState.offer.heal" class="settle-row heal">
          <span>林地疗愈</span><b>+{{ rewardState.offer.heal }} 生命</b>
        </div>
      </div>
      <div v-else class="notice">
        ✦ {{ rewardState.offer.gold }} 金币 · 回复
        {{ rewardState.offer.heal }} 生命
      </div>
      <div class="reward-options">
        <button
          v-for="key in rewardState.offer.cards"
          :key="key"
          :class="{ selected: rewardState.selected === key }"
          @click="chooseReward(key)"
        >
          <b>{{ cards[key]?.name }}</b
          ><small>{{ cards[key]?.text }}</small
          ><em>{{ cards[key]?.rarity }}</em>
        </button>
      </div>
      <div class="toolbar">
        <button
          :disabled="!rewardState.selected"
          data-action="claim"
          @click="$emit('claim', false)"
        >
          收下选中牌与战利品</button
        ><button data-action="skip-reward" @click="$emit('claim', true)">
          仅收取金币
        </button>
      </div>
    </div>
    <div v-else class="empty-mini">
      {{
        rewardState.offer?.claimed
          ? "战利品已收入行囊。下一段路线已开放。"
          : "战胜敌人，发现下一张关键卡牌。"
      }}
    </div>
  </section>
</template>

