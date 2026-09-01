<template>
  <div>
    <div v-for="n in count" :key="n" class="skeleton" :style="{ height: '210px', marginBottom: '14px' }" />
  </div>
</template>

<script setup>
defineProps({
  count: { type: Number, default: 3 }
});
</script>
