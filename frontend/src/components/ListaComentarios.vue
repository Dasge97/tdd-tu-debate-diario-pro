<script setup>
import CommentItem from "@/components/CommentItem.vue";
import EmptyState from "@/components/EmptyState.vue";

/** Lista de comentarios de un debate, con sus respuestas anidadas. */
defineProps({
  comentarios: { type: Array, default: () => [] },
  cargando: { type: Boolean, default: false }
});

const emit = defineEmits(["responder"]);
</script>

<template>
  <div>
    <div v-if="cargando" class="comentarios-esqueleto">
      <div v-for="n in 3" :key="n" class="skeleton" style="height: 74px; margin-bottom: 10px" />
    </div>

    <template v-else-if="comentarios.length">
      <CommentItem
        v-for="comentario in comentarios"
        :key="comentario.id"
        :comment="comentario"
        @reply="emit('responder', $event)"
      />
    </template>

    <EmptyState
      v-else
      icon="chat"
      title="Nadie ha comentado todavía"
      text="Sé la primera persona en argumentar tu posición."
    />
  </div>
</template>
