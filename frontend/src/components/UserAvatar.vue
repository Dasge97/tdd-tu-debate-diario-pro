<script setup>
import { computed } from "vue";
import { nombreVisible } from "@/utils/format";

const props = defineProps({
  user: { type: Object, default: null },
  size: { type: String, default: "md" }
});

const initial = computed(() => (nombreVisible(props.user) || "?").charAt(0).toUpperCase());

const sizeClass = computed(() =>
  props.size === "sm" ? "avatar-sm" : props.size === "lg" ? "avatar-lg" : ""
);

/** Los personajes llevan un anillo con su color. */
const colorPersona = computed(() => props.user?.personaColor || null);
</script>

<template>
  <span
    class="avatar"
    :class="[sizeClass, { 'avatar-persona': colorPersona }]"
    :style="colorPersona ? { '--persona-color': colorPersona } : null"
  >
    <img
      v-if="user?.avatarUrl"
      :src="user.avatarUrl"
      :alt="nombreVisible(user)"
      loading="lazy"
      decoding="async"
    />
    <template v-else>{{ initial }}</template>
  </span>
</template>
