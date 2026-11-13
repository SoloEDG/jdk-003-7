<script setup lang="ts">
import { computed } from "vue";
import { shopState, itemPrice, baseItemPrice } from "../model/state";
import { quoteMessage } from "../lib/pricing";
import { cards } from "@/shared/cards";
import {
  eventState,
  hasActiveDebt,
  SHOP_DEBT_SURCHARGE,
  outstandingTotal,
} from "@/features/event";
defineProps<{ gold: number }>();
defineEmits<{ buy: [id: string]; leave: [] }>();
const inDebt = computed(() => hasActiveDebt(eventState.debts));
const priceOf = (id: string) => itemPrice(id, inDebt.value);
</script>
<template>
  <section class="panel">
    <div class="section-top">
      <span class="eyebrow">04 / THE TRADER</span><span>旅途补给</span>
    </div>
    <h2>路上的旧相识</h2>
    <template v-if="shopState.open"
      ><p class="muted">
        {{
          quoteMessage(
            shopState.context!.influence.favor,
            shopState.context!.influence.scarcity,
          )
        }}
      </p>
      <div v-if="inDebt" class="notice debt-shop-notice">
        ⚠ 你仍欠商人 {{ outstandingTotal() }} 金，每件商品额外收取
        {{ SHOP_DEBT_SURCHARGE }} 金。好感折扣不能减免已承诺的债务附加费。
      </div>
      <div class="stock">
        <div v-for="item in shopState.stock" :key="item.id">
          <div>
            <b>{{ cards[item.card]?.name }}</b
            ><small>{{ cards[item.card]?.text }}</small>
            <small v-if="inDebt" class="surcharge-line">
              基础价 {{ baseItemPrice(item.id) }} 金 + 债务附加
              {{ SHOP_DEBT_SURCHARGE }} 金
            </small>
          </div>
          <button
            :disabled="item.sold || gold < priceOf(item.id)"
            :data-stock="item.id"
            @click="$emit('buy', item.id)"
          >
            {{ item.sold ? "已售出" : priceOf(item.id) + " 金 · 购买" }}
          </button>
        </div>
      </div>
      <button data-action="leave-shop" @click="$emit('leave')">
        收好行囊，继续前进 →
      </button></template
    >
    <div v-else class="empty-mini">
      寻找路线上的天平标记。安路的好感让金币走得更远。
    </div>
  </section>
</template>

