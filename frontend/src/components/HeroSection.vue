<script setup>
import { computed } from "vue";

const props = defineProps({
  highlightedDebate: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(["open-highlight", "go-today", "go-community"]);

const now = new Date();
const dia = computed(() =>
  now.toLocaleDateString("es-ES", { weekday: "long" }).toUpperCase()
);
const fecha = computed(() => {
  const numero = now.getDate();
  const mes = now.toLocaleDateString("es-ES", { month: "long" }).toUpperCase();
  return `${numero} DE ${mes}`;
});

const highlightedMeta = computed(() => {
  const raw = props.highlightedDebate?.positionsRaw || {};
  const votes = Number(raw.support || 0) + Number(raw.oppose || 0) + Number(raw.neutral || 0);
  const comments = Number(props.highlightedDebate?.commentCount || 0);
  return `${votes} votos · ${comments} comentarios`;
});
</script>

<template>
  <section class="hero-section">
    <div class="hero-layout">
      <div class="hero-copy">
        <div class="hero-kicker">PLAZA PÚBLICA DIGITAL</div>
        <h1 class="hero-title">Tu Debate Diario</h1>
        <p class="hero-subtitle">Debate lo que importa en 5 minutos al día</p>

        <div class="hero-actions q-mt-lg">
          <q-btn color="primary" unelevated label="Entrar a los debates de hoy" @click="emit('go-today')" />
          <q-btn flat color="primary" label="Ver comunidad" @click="emit('go-community')" />
        </div>

        <div class="hero-date q-mt-xl">
          <div class="hero-date-kicker">Hoy en portada</div>
          <div class="hero-day">{{ dia }}</div>
          <div class="hero-full-date">{{ fecha }}</div>
        </div>
      </div>

      <div class="hero-highlight surface-card" v-if="highlightedDebate">
        <div class="hero-highlight-label">Debate más caliente de la semana</div>
        <button type="button" class="hero-highlight-card" @click="emit('open-highlight', highlightedDebate.id)">
          <div class="hero-highlight-title">{{ highlightedDebate.title }}</div>
          <div class="hero-highlight-summary">
            {{ highlightedDebate.cardSummary || highlightedDebate.context }}
          </div>
          <div class="hero-highlight-meta">{{ highlightedMeta }}</div>
          <div class="hero-highlight-cta">Entrar al debate</div>
        </button>
      </div>
    </div>
  </section>
</template>
