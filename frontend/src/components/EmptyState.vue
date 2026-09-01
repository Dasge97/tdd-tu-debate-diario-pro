<script setup>
defineProps({
  icon: { type: String, default: "inbox" },
  title: { type: String, required: true },
  text: { type: String, default: "" }
});
</script>

<template>
  <div class="empty-state">
    <div class="material-symbols-rounded">{{ icon }}</div>
    <div class="empty-state-title">{{ title }}</div>
    <p v-if="text" style="margin: 0">{{ text }}</p>
    <slot />
  </div>
</template>
