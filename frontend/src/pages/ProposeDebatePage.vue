<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import AppSelect from "@/components/AppSelect.vue";
import { debatesService } from "@/services/debates.service";
import { useToastStore } from "@/stores/toast";
import { useUsersStore } from "@/stores/users";

const router = useRouter();
const toastStore = useToastStore();
const usersStore = useUsersStore();

const loadingCategories = ref(false);
const creatingDebate = ref(false);
const categoryOptions = ref([]);
const submitError = ref("");

const form = reactive({
  title: "",
  question: "",
  cardSummary: "",
  context: "",
  category: "",
  sourceUrl: ""
});

const isAuthenticated = computed(() => usersStore.isAuthenticated);
const contextCount = computed(() => form.context.trim().length);
const summaryCount = computed(() => form.cardSummary.trim().length);

const humanizeCategory = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const loadCategories = async () => {
  loadingCategories.value = true;
  try {
    const categories = await debatesService.getCategories();
    categoryOptions.value = categories.map((value) => ({
      label: humanizeCategory(value),
      value
    }));

    if (!form.category && categoryOptions.value.length > 0) {
      form.category = categoryOptions.value[0].value;
    }
  } catch (_error) {
    toastStore.error("No se pudieron cargar las categorías disponibles.");
  } finally {
    loadingCategories.value = false;
  }
};

const resetForm = () => {
  form.title = "";
  form.question = "";
  form.cardSummary = "";
  form.context = "";
  form.sourceUrl = "";
  form.category = categoryOptions.value[0]?.value || "";
  submitError.value = "";
};

const submitProposal = async () => {
  submitError.value = "";

  if (!isAuthenticated.value) {
    toastStore.info("Necesitas iniciar sesión para publicar un debate.");
    router.push({ name: "home" });
    return;
  }

  creatingDebate.value = true;
  try {
    const debate = await debatesService.createProposal({
      title: form.title,
      question: form.question,
      cardSummary: form.cardSummary,
      context: form.context,
      category: form.category,
      sourceUrl: form.sourceUrl
    });

    toastStore.success("Tu debate ya está publicado.");
    router.push({ name: "debate", params: { id: debate.id } });
  } catch (error) {
    submitError.value = error?.response?.data?.error || "No se pudo crear el debate.";
    toastStore.error(submitError.value);
  } finally {
    creatingDebate.value = false;
  }
};

onMounted(loadCategories);
</script>

<template>
  <q-page class="q-px-md q-pb-xl propose-debate-page">
    <div class="propose-debate-wrap">
      <h1 class="section-title q-mt-md q-mb-sm">Proponer debate</h1>
      <p class="propose-debate-intro q-mb-lg">
        Publica un debate con el mismo formato que los editoriales de TDD: una pregunta clara, un resumen breve y un contexto que ayude a discutir con criterio.
      </p>

      <q-card flat bordered class="debate-surface propose-debate-card">
        <q-card-section>
          <div class="propose-debate-head q-mb-lg">
            <div>
              <div class="text-subtitle1 text-weight-medium">Tu debate se publicará con tu perfil</div>
              <div class="text-caption text-grey-7 propose-debate-copy">
                Piensa en un tema que merezca conversación pública y redacta la ficha como si fueras la primera persona que quiere abrir el debate.
              </div>
            </div>
          </div>

          <div v-if="!isAuthenticated" class="propose-debate-warning q-mb-md">
            Necesitas iniciar sesión para publicar debates con tu perfil.
          </div>

          <div class="propose-debate-grid">
            <q-input
              v-model="form.title"
              outlined
              label="Título del debate"
              hint="El titular que verá la comunidad en la tarjeta y en la página del debate."
              class="propose-field propose-field-full"
            />

            <q-input
              v-model="form.question"
              outlined
              label="Pregunta central"
              hint="La pregunta que quieres que la gente responda al entrar al debate."
              class="propose-field propose-field-full"
            />

            <AppSelect
              v-model="form.category"
              :options="categoryOptions"
              :loading="loadingCategories"
              label="Categoría"
              class="propose-field"
            />

            <q-input
              v-model="form.sourceUrl"
              outlined
              label="Enlace de referencia (opcional)"
              hint="Puedes añadir una noticia o artículo de apoyo, aunque no se mostrará de forma destacada en la ficha."
              class="propose-field"
            />

            <q-input
              v-model="form.cardSummary"
              outlined
              type="textarea"
              autogrow
              label="Resumen breve"
              hint="Este texto aparecerá en la portada o en listados."
              class="propose-field propose-field-full"
            />
            <div class="propose-field-counter">{{ summaryCount }} caracteres</div>

            <q-input
              v-model="form.context"
              outlined
              type="textarea"
              autogrow
              label="Contexto del debate"
              hint="Explica qué ha pasado, qué está en juego y por qué merece discusión."
              class="propose-field propose-field-full"
            />
            <div class="propose-field-counter">{{ contextCount }} caracteres</div>
          </div>

          <div v-if="submitError" class="text-negative text-caption q-mt-md">{{ submitError }}</div>

          <div class="propose-debate-actions q-mt-lg">
            <q-btn flat color="primary" label="Limpiar" @click="resetForm" />
            <q-btn
              color="primary"
              unelevated
              :loading="creatingDebate"
              :disable="!isAuthenticated"
              label="Publicar debate"
              @click="submitProposal"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>
