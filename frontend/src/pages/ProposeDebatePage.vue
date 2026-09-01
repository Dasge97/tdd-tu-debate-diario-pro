<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { debatesService } from "@/services";
import { useUiStore } from "@/stores/ui";
import { errorMessage } from "@/api/client";

const router = useRouter();
const ui = useUiStore();

/* El servidor solo exige titulo y contexto; el resto es opcional. */
const form = ref({
  title: "",
  question: "",
  cardSummary: "",
  context: "",
  sourceName: "",
  sourceUrl: ""
});

const sending = ref(false);
const error = ref(null);

const canSubmit = computed(
  () => form.value.title.trim().length >= 10 && form.value.context.trim().length >= 30
);

const submit = async () => {
  if (!canSubmit.value || sending.value) return;

  sending.value = true;
  error.value = null;

  const payload = Object.fromEntries(
    Object.entries(form.value)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value !== "")
  );

  try {
    const debate = await debatesService.propose(payload);
    ui.success("Propuesta enviada. Gracias por participar.");
    router.replace({ name: "debate", params: { id: debate.id } });
  } catch (requestError) {
    error.value = errorMessage(requestError, "No hemos podido enviar la propuesta.");
  } finally {
    sending.value = false;
  }
};
</script>

<template>
  <section>
    <p class="text-muted" style="margin: 0 2px 16px; line-height: 1.6">
      Propón un tema de actualidad que merezca debate. Cuanto mejor expliques el contexto,
      más fácil será que la comunidad argumente.
    </p>

    <form class="surface surface-pad" @submit.prevent="submit">
      <p v-if="error" class="form-error">{{ error }}</p>

      <label class="field">
        <span class="field-label">Título</span>
        <input
          v-model="form.title"
          class="input"
          type="text"
          required
          maxlength="180"
          placeholder="El titular del debate"
        />
      </label>

      <label class="field">
        <span class="field-label">La pregunta</span>
        <input
          v-model="form.question"
          class="input"
          type="text"
          maxlength="250"
          placeholder="¿Qué hay que decidir exactamente?"
        />
      </label>

      <label class="field">
        <span class="field-label">Idea central</span>
        <input
          v-model="form.cardSummary"
          class="input"
          type="text"
          maxlength="250"
          placeholder="Una frase que resuma el asunto"
        />
      </label>

      <label class="field">
        <span class="field-label">Contexto</span>
        <textarea
          v-model="form.context"
          class="textarea"
          required
          rows="7"
          placeholder="Explica los hechos, quién está implicado y por qué importa ahora."
        />
      </label>

      <label class="field">
        <span class="field-label">Fuente (opcional)</span>
        <input
          v-model="form.sourceName"
          class="input"
          type="text"
          maxlength="120"
          placeholder="Nombre del medio"
        />
      </label>

      <label class="field">
        <span class="field-label">Enlace a la fuente (opcional)</span>
        <input
          v-model="form.sourceUrl"
          class="input"
          type="url"
          inputmode="url"
          placeholder="https://"
        />
      </label>

      <button class="btn btn-primary btn-block" type="submit" :disabled="!canSubmit || sending">
        {{ sending ? "Enviando…" : "Enviar propuesta" }}
      </button>

      <p v-if="!canSubmit" class="text-muted" style="margin: 10px 0 0; font-size: 0.82rem">
        Necesitas un título de al menos 10 caracteres y un contexto de al menos 30.
      </p>
    </form>
  </section>
</template>
