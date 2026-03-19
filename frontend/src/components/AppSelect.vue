<script setup>
import { computed } from "vue";

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ""
  },
  options: {
    type: Array,
    default: () => []
  },
  label: {
    type: String,
    default: ""
  },
  hint: {
    type: String,
    default: ""
  },
  placeholder: {
    type: String,
    default: ""
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  dense: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["update:modelValue"]);

const normalizedValue = computed(() => String(props.modelValue ?? ""));
const resolvedPlaceholder = computed(() => {
  if (props.loading) return "Cargando...";
  return props.placeholder || (props.label ? `Selecciona ${props.label.toLowerCase()}` : "Selecciona una opción");
});

const hasEmptyOption = computed(() => props.options.some((option) => String(option?.value ?? "") === ""));

const onChange = (event) => {
  emit("update:modelValue", event.target.value);
};
</script>

<template>
  <div class="app-select" :class="{ 'app-select-dense': dense, 'app-select-disabled': disabled || loading }">
    <label v-if="label" class="app-select-label">{{ label }}</label>
    <div class="app-select-control-wrap">
      <select
        class="app-select-control"
        :value="normalizedValue"
        :disabled="disabled || loading"
        @change="onChange"
      >
        <option v-if="!hasEmptyOption" value="" disabled>{{ resolvedPlaceholder }}</option>
        <option
          v-for="option in options"
          :key="`${option.value}`"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <span class="material-icons app-select-icon" aria-hidden="true">expand_more</span>
    </div>
    <div v-if="hint" class="app-select-hint">{{ hint }}</div>
  </div>
</template>

<style scoped>
.app-select {
  min-width: 0;
}

.app-select-label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.86rem;
  font-weight: 600;
  color: #4b5563;
}

.app-select-control-wrap {
  position: relative;
}

.app-select-control {
  width: 100%;
  min-height: 52px;
  padding: 0 42px 0 14px;
  border: 1px solid #cfd7e3;
  border-radius: 14px;
  background: rgba(255, 253, 249, 0.96);
  color: #14171f;
  font: inherit;
  line-height: 1.35;
  appearance: none;
  -webkit-appearance: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.app-select-control:focus {
  outline: 0;
  border-color: #1f4ba3;
  box-shadow: 0 0 0 3px rgba(31, 75, 163, 0.12);
  background: #fff;
}

.app-select-control:disabled {
  color: #8a94a6;
  cursor: not-allowed;
}

.app-select-dense .app-select-control {
  min-height: 46px;
}

.app-select-icon {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  pointer-events: none;
  color: #667085;
  font-size: 22px;
}

.app-select-hint {
  margin-top: 6px;
  font-size: 0.76rem;
  line-height: 1.35;
  color: #8b7d70;
}

.app-select-disabled .app-select-icon {
  color: #98a2b3;
}
</style>
