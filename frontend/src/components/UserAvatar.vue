<script setup>
import { computed } from "vue";

const props = defineProps({
  user: { type: Object, default: null },
  size: { type: String, default: "md" }
});

const initial = computed(() => (props.user?.username || "?").charAt(0).toUpperCase());

const sizeClass = computed(() =>
  props.size === "sm" ? "avatar-sm" : props.size === "lg" ? "avatar-lg" : ""
);
</script>

<template>
  <span class="avatar" :class="sizeClass">
    <img
      v-if="user?.avatarUrl"
      :src="user.avatarUrl"
      :alt="user.username"
      loading="lazy"
      decoding="async"
    />
    <template v-else>{{ initial }}</template>
  </span>
</template>
