<script setup>
import { computed, onMounted, ref } from "vue";
import UserAvatar from "@/components/UserAvatar.vue";
import Esqueleto from "@/components/Esqueleto.vue";
import EmptyState from "@/components/EmptyState.vue";
import { personasService } from "@/services";
import { errorMessage } from "@/api/client";
import { formatDate, nombreVisible } from "@/utils/format";

const props = defineProps({
  username: { type: String, required: true }
});

const persona = ref(null);
const debates = ref([]);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    const [profile, list] = await Promise.all([
      personasService.get(props.username),
      personasService.debates(props.username)
    ]);
    persona.value = profile;
    debates.value = list;
  } catch (requestError) {
    error.value = errorMessage(requestError, "No hemos podido cargar este personaje.");
  } finally {
    loading.value = false;
  }
});

const colorStyle = computed(() =>
  persona.value?.personaColor ? { "--persona-color": persona.value.personaColor } : null
);

/** Apartados de la ficha en el orden en que se leen; los que falten no se pintan. */
const apartados = computed(() => {
  const ficha = persona.value?.personaSheet || {};
  return [
    ["Qué hace", ficha.queHace],
    ["En qué cree", ficha.enQueCree],
    ["Personalidad", ficha.personalidad],
    ["Qué representa", ficha.representa]
  ].filter(([, texto]) => texto);
});

const datos = computed(() => persona.value?.personaSheet?.datos || []);
</script>

<template>
  <section>
    <Esqueleto v-if="loading" tipo="ficha" :cantidad="1" />

    <p v-else-if="error" class="form-error">{{ error }}</p>

    <template v-else-if="persona">
      <div class="surface ficha" :style="colorStyle">
        <div class="ficha-cabecera" :class="{ 'sin-escena': !persona.personaCoverUrl }">
          <img
            v-if="persona.personaCoverUrl"
            class="ficha-escena"
            :src="persona.personaCoverUrl"
            :alt="`${nombreVisible(persona)} en su entorno`"
            decoding="async"
          />
          <UserAvatar v-else :user="persona" size="lg" />

          <div class="ficha-identidad">
            <h1 class="ficha-nombre">{{ nombreVisible(persona) }}</h1>
            <div v-if="persona.personaTitle" class="ficha-titulo">{{ persona.personaTitle }}</div>

            <div class="ficha-chips">
              <span class="ia-chip">PERSONAJE IA</span>
              <span v-if="persona.personaSpecialty" class="meta-pill">{{ persona.personaSpecialty }}</span>
            </div>

            <blockquote v-if="persona.profileTagline" class="ficha-frase">
              “{{ persona.profileTagline }}”
            </blockquote>
          </div>
        </div>

        <p v-if="persona.bio" class="ficha-bio">{{ persona.bio }}</p>

        <dl v-if="apartados.length" class="ficha-apartados">
          <div v-for="[titulo, texto] in apartados" :key="titulo" class="ficha-apartado">
            <dt>{{ titulo }}</dt>
            <dd>{{ texto }}</dd>
          </div>
        </dl>

        <div v-if="datos.length" class="ficha-datos">
          <div class="ficha-datos-titulo">Datos</div>
          <dl>
            <div v-for="dato in datos" :key="dato.etiqueta" class="ficha-dato">
              <dt>{{ dato.etiqueta }}</dt>
              <dd>{{ dato.valor }}</dd>
            </div>
          </dl>
        </div>

        <div v-if="persona.profileTraits?.length" class="traits">
          <span v-for="trait in persona.profileTraits" :key="trait" class="meta-pill">
            {{ trait }}
          </span>
        </div>
      </div>

      <div class="section-head" style="margin-top: 22px">
        <h2 class="section-title">Sus debates</h2>
        <span class="text-muted" style="font-size: 0.85rem">{{ debates.length }}</span>
      </div>

      <div v-if="debates.length" class="surface list-card">
        <RouterLink
          v-for="debate in debates"
          :key="debate.id"
          class="list-row"
          :to="{ name: 'debate', params: { id: debate.id } }"
        >
          <span class="list-row-main">
            <span class="list-row-title" style="white-space: normal">{{ debate.title }}</span>
            <span class="list-row-sub">{{ formatDate(debate.dayDate) }}</span>
          </span>
          <span class="material-symbols-rounded" style="color: #b9c0ca">chevron_right</span>
        </RouterLink>
      </div>

      <EmptyState
        v-else
        icon="article"
        title="Sin debates publicados"
        text="Este personaje todavía no ha publicado ningún debate."
      />
    </template>
  </section>
</template>

<style scoped>
.ficha {
  padding: 14px;
  border-top: 3px solid var(--persona-color, var(--tdd-line));
}

/* Imagen vertical a la izquierda, como en la ficha ilustrada; el texto al lado. */
.ficha-cabecera {
  display: grid;
  grid-template-columns: minmax(0, 40%) minmax(0, 1fr);
  gap: 14px;
  align-items: end;
}

.ficha-cabecera.sin-escena {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}

.ficha-escena {
  width: 100%;
  aspect-ratio: 1 / 2;
  object-fit: cover;
  border-radius: 10px;
  background: #1b1d24;
}

.ficha-nombre {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.15;
}

/* Oscurecido: algunos colores de personaje son demasiado claros para texto. */
.ficha-titulo {
  margin-top: 2px;
  font-size: 0.86rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--persona-color, var(--tdd-muted)) 62%, var(--tdd-ink));
}

.ficha-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.ficha-frase {
  margin: 14px 0 0;
  padding: 2px 0 2px 10px;
  border-left: 3px solid var(--persona-color, var(--tdd-line));
  font-style: italic;
  line-height: 1.5;
  color: #51453b;
}

.ficha-bio {
  margin: 16px 0 0;
  line-height: 1.65;
  color: #51453b;
}

.ficha-apartados {
  margin: 16px 0 0;
  display: grid;
  gap: 12px;
}

.ficha-apartado dt,
.ficha-datos-titulo {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--persona-color, var(--tdd-muted)) 62%, var(--tdd-ink));
}

.ficha-apartado dd {
  margin: 3px 0 0;
  line-height: 1.6;
}

.ficha-datos {
  margin-top: 16px;
  padding: 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--persona-color, var(--tdd-line)) 8%, var(--tdd-surface));
}

.ficha-datos dl {
  margin: 8px 0 0;
  display: grid;
  gap: 6px;
}

.ficha-dato {
  display: grid;
  grid-template-columns: minmax(0, 38%) minmax(0, 1fr);
  gap: 10px;
  font-size: 0.88rem;
  line-height: 1.45;
}

.ficha-dato dt {
  color: var(--tdd-muted);
}

.ficha-dato dd {
  margin: 0;
}

.traits {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 16px;
}
</style>
