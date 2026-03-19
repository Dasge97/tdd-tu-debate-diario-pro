<script setup>
import { storeToRefs } from "pinia";
import { useToastStore } from "@/stores/toast";

const toastStore = useToastStore();
const { items } = storeToRefs(toastStore);
</script>

<template>
  <div class="toast-host">
    <transition-group name="toast-stack">
      <div
        v-for="toast in items"
        :key="toast.id"
        class="app-toast"
        :class="`app-toast-${toast.type}`"
      >
        <div class="app-toast-main">
          <div v-if="toast.title" class="app-toast-title">{{ toast.title }}</div>
          <div class="app-toast-message">{{ toast.message }}</div>
        </div>
        <button type="button" class="app-toast-close" @click="toastStore.dismiss(toast.id)">×</button>
      </div>
    </transition-group>
  </div>
</template>
