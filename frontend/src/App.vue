<script setup>
import GlobalModalHost from "@/components/GlobalModalHost.vue";
import GlobalToastHost from "@/components/GlobalToastHost.vue";
</script>

<template>
  <router-view />
  <global-modal-host />
  <global-toast-host />
</template>
