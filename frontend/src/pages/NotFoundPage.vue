<script setup>
import EmptyState from "@/components/EmptyState.vue";
</script>

<template>
  <EmptyState icon="explore_off" title="Página no encontrada" text="Ese enlace ya no existe.">
    <RouterLink class="btn btn-primary" :to="{ name: 'home' }" style="margin-top: 16px">
      Ir a los debates de hoy
    </RouterLink>
  </EmptyState>
</template>
