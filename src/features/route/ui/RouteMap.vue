<script setup lang="ts">
import { computed } from "vue";
import { routeState, choices, previewRoute } from "../model/state";
import {
  eventState,
  dueDepths,
  debtsDueAt,
  remainingDebt,
  pendingAdvanceAmount,
} from "@/features/event";
import { regionNames } from "@/shared/domain";
const emit = defineEmits<{ enter: [id: string] }>();
const allowed = computed(() => choices());
const layers = computed(() =>
  Array.from({ length: 9 }, (_, d) =>
    routeState.nodes.filter((n) => n.depth === d),
  ),
);
const symbols = {
  battle: "⚔",
  elite: "♜",
  shop: "⚖",
  camp: "♨",
  event: "⚕",
  boss: "◈",
};
const dueAtDepth = computed(() => new Set(dueDepths(eventState.debts)));
</script>
<template>
  <section class="panel route-panel">
    <div class="section-top">
      <span class="eyebrow">01 / THE PATH</span
      ><span>已走 {{ routeState.visited.length }} / 9</span>
    </div>
    <h2>每一步，留下回响</h2>
    <p class="muted">
      林地 → 熔铁边境 → 无声深渊。险路增加敌人力量与稀有奖励，安路积累商人好感。⚕
      标记的歧路契约可用卡牌、预支奖励或借债换取即时收益。
    </p>
    <div class="route-scroll">
      <div v-for="(layer, d) in layers" :key="d" class="route-row">
        <span class="depth">
          {{ d + 1
          }}<i v-if="dueAtDepth.has(d)" class="due-dot" title="债务到期">⚠</i>
        </span>
        <button
          v-for="node in layer"
          :key="node.id"
          :data-node="node.id"
          class="route-node"
          :class="{
            available: allowed.includes(node.id),
            visited: routeState.visited.includes(node.id),
            'debt-due': debtsDueAt(eventState.debts, node.depth).length > 0,
          }"
          :disabled="!allowed.includes(node.id)"
          @mouseenter="previewRoute(node.id)"
          @mouseleave="previewRoute('')"
          @click="emit('enter', node.id)"
        >
          <b>{{ symbols[node.kind] }}</b
          ><span
            >{{ node.title
            }}<small
              >{{ regionNames[node.region] }} ·
              {{ node.lane ? "威胁 +1 / 稀缺 +1" : "好感 +1" }}</small
            >
            <small
              v-if="debtsDueAt(eventState.debts, node.depth).length"
              class="debt-line"
            >
              ⚠ 债务到期：剩余
              {{
                debtsDueAt(eventState.debts, node.depth).reduce(
                  (s, db) => s + remainingDebt(db),
                  0,
                )
              }}
              金
            </small>
          </span
          ><i>{{ routeState.visited.includes(node.id) ? "✓" : "↗" }}</i>
        </button>
      </div>
    </div>
    <div v-if="routeState.preview" class="notice">
      路途预览 · 威胁 {{ routeState.preview.influence.heat }} / 好感
      {{ routeState.preview.influence.favor }} / 稀缺
      {{ routeState.preview.influence.scarcity }}
    </div>
    <div v-if="pendingAdvanceAmount() > 0" class="notice advance-notice">
      ⧖ 已预支 {{ pendingAdvanceAmount() }} 金币：下一场战斗胜利的战利品将优先抵扣该金额。
    </div>
    <div v-if="dueAtDepth.size" class="notice debt-notice">
      ⚕ 路线已标注债务到期节点：
      {{ Array.from(dueAtDepth).map((d) => `第 ${d + 1} 层`).join("、") }}
    </div>
  </section>
</template>

