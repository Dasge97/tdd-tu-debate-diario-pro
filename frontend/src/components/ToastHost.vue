<script setup>
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite">
    <div
      v-for="toast in ui.toasts"
      :key="toast.id"
      class="toast"
      :class="{ 'toast-error': toast.tone === 'error', 'toast-success': toast.tone === 'success' }"
    >
      {{ toast.message }}
    </div>
  </div>
</template>
