<script setup>
import { computed, onMounted, ref } from "vue";
import PositionBar from "@/components/PositionBar.vue";
import ListaComentarios from "@/components/ListaComentarios.vue";
import RedactorComentario from "@/components/RedactorComentario.vue";
import UserAvatar from "@/components/UserAvatar.vue";
import Lateral from "@/components/Lateral.vue";
import HojaOpcionesDebate from "@/components/HojaOpcionesDebate.vue";
import HojaPersonaje from "@/components/HojaPersonaje.vue";
import { useDebatesStore } from "@/stores/debates";
import { useFavoritesStore } from "@/stores/favorites";
import { useUiStore } from "@/stores/ui";
import { debatesService, participationService } from "@/services";
import { errorMessage } from "@/api/client";
import { formatDateTime, plural, toParagraphs } from "@/utils/format";
import { useSesion } from "@/composables/useSesion";

const props = defineProps({
  id: { type: [String, Number], required: true }
});

const debates = useDebatesStore();
const favorites = useFavoritesStore();
const ui = useUiStore();
const { auth, exigeSesion } = useSesion();

const debateId = Number(props.id);

const debate = ref(debates.byId[debateId] || null);
const comentarios = ref([]);
const cargando = ref(true);
const cargandoComentarios = ref(true);
const errorCarga = ref(null);

const respondiendoA = ref(null);
const enviando = ref(false);
const redactor = ref(null);
const hoja = ref(null);

/**
 * La API no devuelve que posicion eligio el usuario, solo los recuentos.
 * Se guarda en el navegador para que el boton siga marcado al volver.
 */
const CLAVE_POSICIONES = "tdd.myPositions";

const leerPosiciones = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_POSICIONES) || "{}");
  } catch (_) {
    return {};
  }
};

const miPosicion = ref(leerPosiciones()[debateId] || null);

const porcentajes = computed(() => debates.percentagesFor(debateId));
const esFavorito = computed(() => favorites.isFavorite(debateId));
const autor = computed(() => debate.value?.createdBy || null);
const parrafos = computed(() => toParagraphs(debate.value?.context));
const totalComentarios = computed(() =>
  comentarios.value.reduce((suma, c) => suma + 1 + (c.replies?.length || 0), 0)
);

const cargar = async () => {
  cargando.value = true;
  errorCarga.value = null;
  try {
    const [detalle] = await Promise.all([
      debatesService.byId(debateId),
      debates.fetchPositions(debateId).catch(() => {})
    ]);
    debate.value = detalle;
  } catch (error) {
    errorCarga.value = errorMessage(error, "No hemos podido cargar este debate.");
  } finally {
    cargando.value = false;
  }
};

const cargarComentarios = async () => {
  cargandoComentarios.value = true;
  try {
    comentarios.value = await participationService.getComments(debateId);
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido cargar los comentarios."));
  } finally {
    cargandoComentarios.value = false;
  }
};

onMounted(() => {
  cargar();
  cargarComentarios();
});

const fijarPosicion = async (posicion) => {
  if (!exigeSesion("fijar tu posición")) return;

  const anterior = miPosicion.value;
  miPosicion.value = posicion;

  try {
    await debates.setPosition(debateId, posicion);

    const guardadas = leerPosiciones();
    guardadas[debateId] = posicion;
    localStorage.setItem(CLAVE_POSICIONES, JSON.stringify(guardadas));
  } catch (error) {
    miPosicion.value = anterior;
    ui.error(errorMessage(error, "No hemos podido registrar tu posición."));
  }
};

const alternarFavorito = async () => {
  if (!exigeSesion("guardar debates")) return;

  try {
    const guardado = await favorites.toggle(debateId);
    ui.success(guardado ? "Guardado en favoritos" : "Quitado de favoritos");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido guardar el favorito."));
  }
};

const responder = (comentario) => {
  if (!exigeSesion("responder")) return;

  respondiendoA.value = comentario;
  redactor.value?.enfocar();
};

const enviar = async (contenido) => {
  enviando.value = true;
  try {
    await participationService.addComment(debateId, contenido, respondiendoA.value?.id ?? null);
    respondiendoA.value = null;
    await cargarComentarios();
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido publicar tu comentario."));
  } finally {
    enviando.value = false;
  }
};
</script>

<template>
  <section class="con-lateral has-composer">
    <div>
      <div v-if="cargando && !debate" class="skeleton" style="height: 320px" />

      <p v-else-if="errorCarga" class="form-error">{{ errorCarga }}</p>

      <template v-else-if="debate">
        <article class="debate-surface debate-detail">
          <div class="debate-card-topbar">
            <button
              v-if="autor"
              type="button"
              class="debate-author"
              @click="hoja = 'personaje'"
            >
              <UserAvatar :user="autor" size="sm" />
              <span style="min-width: 0; text-align: left">
                <span class="debate-author-name">{{ autor.username }}</span>
                <span v-if="autor.personaSpecialty" class="debate-author-tag">
                  · {{ autor.personaSpecialty }}
                </span>
              </span>
            </button>

            <span style="display: flex">
              <button
                type="button"
                class="icon-btn"
                :aria-label="esFavorito ? 'Quitar de favoritos' : 'Guardar en favoritos'"
                @click="alternarFavorito"
              >
                <span
                  class="material-symbols-rounded"
                  :style="esFavorito ? `color:#e74c3c;font-variation-settings:'FILL' 1` : ''"
                >
                  favorite
                </span>
              </button>
              <button type="button" class="icon-btn" aria-label="Más opciones" @click="hoja = 'opciones'">
                <span class="material-symbols-rounded">more_horiz</span>
              </button>
            </span>
          </div>

          <div class="debate-kicker-row">
            <span v-if="autor?.isAiPersona" class="debate-kicker-chip">Generado por IA</span>
            <span v-if="debate.publishedAt" class="debate-kicker-text">
              {{ formatDateTime(debate.publishedAt) }}
            </span>
          </div>

          <h1 class="debate-title">{{ debate.title }}</h1>

          <div class="debate-section-label">De qué va este debate</div>

          <p v-if="debate.question" class="debate-story-paragraph debate-story-question">
            <span class="debate-story-lead">La pregunta:</span>
            {{ debate.question }}
          </p>

          <p v-if="debate.cardSummary" class="debate-story-paragraph">
            <span class="debate-story-lead">La idea central:</span>
            {{ debate.cardSummary }}
          </p>

          <p v-for="(parrafo, indice) in parrafos" :key="indice" class="debate-story-paragraph">
            {{ parrafo }}
          </p>

          <p v-if="debate.sourceUrl" style="margin-top: 16px">
            <a :href="debate.sourceUrl" target="_blank" rel="noopener noreferrer">
              Fuente: {{ debate.sourceName || debate.sourceUrl }}
            </a>
          </p>

          <div style="margin-top: 20px">
            <PositionBar :percentages="porcentajes" />

            <div class="position-picker">
              <button
                type="button"
                class="position-btn"
                :class="{ 'is-active-support': miPosicion === 'support' }"
                @click="fijarPosicion('support')"
              >
                <span class="material-symbols-rounded">thumb_up</span>
                A favor
              </button>
              <button
                type="button"
                class="position-btn"
                :class="{ 'is-active-neutral': miPosicion === 'neutral' }"
                @click="fijarPosicion('neutral')"
              >
                <span class="material-symbols-rounded">drag_handle</span>
                Neutral
              </button>
              <button
                type="button"
                class="position-btn"
                :class="{ 'is-active-oppose': miPosicion === 'oppose' }"
                @click="fijarPosicion('oppose')"
              >
                <span class="material-symbols-rounded">thumb_down</span>
                En contra
              </button>
            </div>

            <p class="text-muted" style="margin: 10px 0 0; font-size: 0.84rem">
              {{ plural(porcentajes?.total ?? 0, "persona ya ha", "personas ya han") }}
              fijado su posición.
            </p>
          </div>
        </article>

        <div class="section-head" style="margin-top: 22px">
          <h2 class="section-title">Comentarios</h2>
          <span class="text-muted" style="font-size: 0.85rem">{{ totalComentarios }}</span>
        </div>

        <div class="surface surface-pad comentarios-caja">
          <ListaComentarios
            :comentarios="comentarios"
            :cargando="cargandoComentarios"
            @responder="responder"
          />
        </div>

        <RedactorComentario
          ref="redactor"
          :respondiendo-a="respondiendoA"
          :enviando="enviando"
          @enviar="enviar"
          @cancelar-respuesta="respondiendoA = null"
        />

        <HojaOpcionesDebate :abierta="hoja === 'opciones'" :debate="debate" @cerrar="hoja = null" />

        <HojaPersonaje
          :abierta="hoja === 'personaje'"
          :username="autor?.username || ''"
          @cerrar="hoja = null"
        />
      </template>
    </div>

    <Lateral :excluir-id="debateId" />
  </section>
</template>
