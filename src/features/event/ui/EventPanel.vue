<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  eventState,
  activeEncounter,
  previewOption,
} from "../model/state";
import { deckState } from "@/features/deck";
import { cards } from "@/shared/cards";

const emit = defineEmits<{ confirm: [optionId: string]; leave: [] }>();

const selected = ref("");
const def = computed(() => activeEncounter());
const deckKeys = computed(() => deckState.cards.map((c) => c.key));

const preview = computed(() =>
  selected.value
    ? previewOption(selected.value, deckKeys.value, deckState.hero.gold)
    : null,
);

watch(
  () => eventState.active?.nodeId,
  () => {
    selected.value = "";
  },
);

function cardName(key?: string) {
  return key ? cards[key]?.name ?? key : "";
}
</script>

<template>
  <section class="panel event-panel">
    <div class="section-top">
      <span class="eyebrow">06 / THE ENCOUNTER</span><span>选择代价</span>
    </div>
    <h2>{{ def?.title ?? "旅途事件" }}</h2>
    <p class="muted">{{ def?.intro }}</p>

    <div v-if="def && !eventState.active?.resolved" class="event-options">
      <button
        v-for="opt in def.options"
        :key="opt.id"
        class="event-option"
        :class="{ selected: selected === opt.id }"
        @click="selected = opt.id"
      >
        <b>{{ opt.label }}</b>
        <small>{{ opt.detail }}</small>
        <em v-if="opt.costType === 'card'">
          交付：{{ cardName(opt.cardKey) }}
          <span
            :class="{
              unavailable: !deckKeys.includes(opt.cardKey!),
            }"
          >
            （拥有 {{ deckKeys.filter((k) => k === opt.cardKey).length }} 张）
          </span>
        </em>
      </button>
    </div>

    <!-- 选择前展示即时损益与未来到期条件；此阶段不扣除任何资源 -->
    <div v-if="preview" class="event-preview" :class="{ blocked: !preview.ok }">
      <h3>签约预览 · 确认后才扣除卡牌与金币</h3>
      <div v-if="!preview.ok" class="preview-warn">⚠ {{ preview.reason }}</div>
      <div class="preview-cols">
        <div>
          <span class="eyebrow">即时损益</span>
          <p v-for="(line, i) in preview.immediate" :key="'i' + i" class="gain">
            ✦ {{ line }}
          </p>
          <p v-if="!preview.immediate.length" class="muted">无即时变动</p>
        </div>
        <div>
          <span class="eyebrow">未来到期条件</span>
          <p v-for="(line, i) in preview.future" :key="'f' + i" class="due">
            ⧖ {{ line }}
          </p>
          <p v-if="!preview.future.length" class="muted">无后续后果</p>
        </div>
      </div>
      <div class="toolbar">
        <button
          data-action="confirm-event"
          :disabled="!preview.ok"
          @click="emit('confirm', selected)"
        >
          确认选择并结算代价
        </button>
        <button data-action="leave-event" @click="emit('leave')">
          转身离开
        </button>
      </div>
    </div>

    <div v-else-if="eventState.active?.resolved" class="notice">
      选择已立下契约，代价已经结算。继续前进 →
      <div class="toolbar">
        <button data-action="leave-event" @click="emit('leave')">
          回到路线
        </button>
      </div>
    </div>
  </section>
</template>
