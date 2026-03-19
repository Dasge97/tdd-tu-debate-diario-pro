<script setup>
import { storeToRefs } from "pinia";
import { useModalStore } from "@/stores/modal";

const modalStore = useModalStore();
const { isOpen, title, message, confirmLabel, cancelLabel, variant, persistent } = storeToRefs(modalStore);
</script>

<template>
  <q-dialog
    :model-value="isOpen"
    :persistent="persistent"
    @hide="modalStore.resolve(false)"
  >
    <q-card class="app-modal-card">
      <q-card-section class="app-modal-head">
        <div class="app-modal-title">{{ title }}</div>
        <div v-if="message" class="app-modal-copy">{{ message }}</div>
      </q-card-section>

      <q-card-actions align="right" class="app-modal-actions">
        <q-btn
          v-if="variant === 'confirm' && cancelLabel"
          flat
          no-caps
          :label="cancelLabel"
          @click="modalStore.resolve(false)"
        />
        <q-btn
          color="primary"
          unelevated
          no-caps
          :label="confirmLabel"
          @click="modalStore.resolve(true)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
