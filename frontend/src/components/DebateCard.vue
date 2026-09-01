<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import UserAvatar from "@/components/UserAvatar.vue";
import PositionBar from "@/components/PositionBar.vue";
import HojaComentarios from "@/components/HojaComentarios.vue";
import HojaPosicion from "@/components/HojaPosicion.vue";
import HojaOpcionesDebate from "@/components/HojaOpcionesDebate.vue";
import HojaPersonaje from "@/components/HojaPersonaje.vue";
import { useDebatesStore } from "@/stores/debates";
import { plural } from "@/utils/format";
import { useFavoritesStore } from "@/stores/favorites";
import { useUiStore } from "@/stores/ui";
import { useSesion } from "@/composables/useSesion";
import { errorMessage } from "@/api/client";

const props = defineProps({
  debate: { type: Object, required: true }
});

const router = useRouter();
const debates = useDebatesStore();
const favorites = useFavoritesStore();
const ui = useUiStore();
const { exigeSesion } = useSesion();

const percentages = computed(() => debates.percentagesFor(props.debate.id));
const isFavorite = computed(() => favorites.isFavorite(props.debate.id));
const summary = computed(() => props.debate.cardSummary || props.debate.context || "");
const author = computed(() => props.debate.createdBy || null);

const comentarios = ref(Number(props.debate.commentCount || 0));

const hoja = ref(null);
const latido = ref(false);

const abrirDebate = () => router.push({ name: "debate", params: { id: props.debate.id } });

const alternarFavorito = async () => {
  if (!exigeSesion("guardar debates")) return;

  try {
    const guardado = await favorites.toggle(props.debate.id);
    ui.success(guardado ? "Guardado en favoritos" : "Quitado de favoritos");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido guardar el favorito."));
  }
};

/* Doble toque para guardar, con el corazon que late encima de la tarjeta. */
let ultimoToque = 0;

const alTocar = () => {
  const ahora = Date.now();

  if (ahora - ultimoToque < 300) {
    ultimoToque = 0;
    dobleToque();
    return;
  }

  ultimoToque = ahora;
};

const dobleToque = async () => {
  if (!exigeSesion("guardar debates")) return;

  latido.value = true;
  window.setTimeout(() => {
    latido.value = false;
  }, 700);

  // El doble toque solo guarda: repetirlo no debe quitar el favorito.
  if (isFavorite.value) return;

  try {
    await favorites.toggle(props.debate.id);
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido guardar el favorito."));
  }
};
</script>

<template>
  <article class="debate-card debate-surface">
    <div class="debate-card-topbar">
      <button
        v-if="author"
        type="button"
        class="debate-author"
        @click="hoja = 'personaje'"
      >
        <UserAvatar :user="author" size="sm" />
        <span style="min-width: 0; text-align: left">
          <span class="debate-author-name">{{ author.username }}</span>
          <span v-if="author.personaSpecialty" class="debate-author-tag">
            · {{ author.personaSpecialty }}
          </span>
        </span>
      </button>

      <button
        type="button"
        class="icon-btn"
        aria-label="Más opciones"
        @click="hoja = 'opciones'"
      >
        <span class="material-symbols-rounded">more_horiz</span>
      </button>
    </div>

    <div
      class="debate-card-cuerpo"
      role="button"
      tabindex="0"
      @click="abrirDebate"
      @touchend="alTocar"
      @keydown.enter="abrirDebate"
      @keydown.space.prevent="abrirDebate"
    >
      <h2 class="debate-title">{{ debate.title }}</h2>

      <p v-if="summary" class="debate-context">{{ summary }}</p>

      <PositionBar :percentages="percentages" />

      <Transition name="latido">
        <span v-if="latido" class="latido-corazon material-symbols-rounded">favorite</span>
      </Transition>
    </div>

    <!-- Acciones rapidas, al estilo de una app: no hace falta entrar al debate. -->
    <div class="debate-acciones">
      <button
        type="button"
        class="accion"
        :class="{ 'accion-activa': isFavorite }"
        :aria-label="isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'"
        @click="alternarFavorito"
      >
        <span
          class="material-symbols-rounded"
          :style="isFavorite ? `font-variation-settings: 'FILL' 1` : ''"
        >
          favorite
        </span>
      </button>

      <button type="button" class="accion" aria-label="Comentarios" @click="hoja = 'comentarios'">
        <span class="material-symbols-rounded">chat_bubble</span>
        {{ comentarios }}
      </button>

      <button type="button" class="accion" aria-label="Fijar posición" @click="hoja = 'posicion'">
        <span class="material-symbols-rounded">how_to_vote</span>
        {{ plural(percentages?.total ?? 0, "voto", "votos") }}
      </button>

      <span class="debate-acciones-relleno" />

      <button type="button" class="btn btn-primary btn-sm solo-ancho" @click="abrirDebate">
        Entrar al debate
      </button>
    </div>

    <HojaComentarios
      :abierta="hoja === 'comentarios'"
      :debate-id="debate.id"
      @cerrar="hoja = null"
      @comentado="comentarios = $event"
    />

    <HojaPosicion
      :abierta="hoja === 'posicion'"
      :debate-id="debate.id"
      :titulo="debate.title"
      @cerrar="hoja = null"
    />

    <HojaOpcionesDebate :abierta="hoja === 'opciones'" :debate="debate" @cerrar="hoja = null" />

    <HojaPersonaje
      :abierta="hoja === 'personaje'"
      :username="author?.username || ''"
      @cerrar="hoja = null"
    />
  </article>
</template>
