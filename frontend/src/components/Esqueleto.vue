<script setup>
/**
 * Bloques grises mientras carga, en lugar de una rueda girando.
 * La rueda se ve de web; los bloques adelantan la forma de lo que va a llegar.
 */
defineProps({
  /** "lista" para filas, "tarjetas" para tarjetas de debate, "ficha" para un perfil. */
  tipo: { type: String, default: "lista" },
  cantidad: { type: Number, default: 4 }
});

const alturas = {
  lista: 62,
  tarjetas: 190,
  ficha: 220,
  burbujas: 54
};
</script>

<template>
  <div class="esqueleto-grupo">
    <div
      v-for="n in cantidad"
      :key="n"
      class="skeleton"
      :style="{ height: `${alturas[tipo] || 62}px` }"
    />
  </div>
</template>

<style scoped>
.esqueleto-grupo {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
