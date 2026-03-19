<script setup>
const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ""
  },
  label: {
    type: String,
    default: ""
  },
  placeholder: {
    type: String,
    default: ""
  },
  type: {
    type: String,
    default: "text"
  },
  inputmode: {
    type: String,
    default: ""
  },
  maxlength: {
    type: [String, Number],
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  dense: {
    type: Boolean,
    default: false
  },
  leadingIcon: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["update:modelValue", "keyup.enter"]);

const onInput = (event) => {
  emit("update:modelValue", event.target.value);
};

const onKeyup = (event) => {
  if (event.key === "Enter") {
    emit("keyup.enter", event);
  }
};
</script>

<template>
  <label class="app-input" :class="{ 'app-input-dense': dense, 'app-input-disabled': disabled }">
    <span v-if="label" class="app-input-label">{{ label }}</span>
    <span class="app-input-control-wrap" :class="{ 'app-input-with-icon': leadingIcon }">
      <span v-if="leadingIcon" class="material-icons app-input-icon" aria-hidden="true">{{ leadingIcon }}</span>
      <input
        class="app-input-control"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :inputmode="inputmode || undefined"
        :maxlength="maxlength || undefined"
        :disabled="disabled"
        @input="onInput"
        @keyup="onKeyup"
      />
    </span>
  </label>
</template>

<style scoped>
.app-input {
  display: block;
  min-width: 0;
}

.app-input-label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.86rem;
  font-weight: 600;
  color: #4b5563;
}

.app-input-control-wrap {
  position: relative;
  display: block;
}

.app-input-control {
  width: 100%;
  min-height: 52px;
  padding: 0 14px;
  border: 1px solid #cfd7e3;
  border-radius: 14px;
  background: rgba(255, 253, 249, 0.96);
  color: #14171f;
  font: inherit;
  line-height: 1.35;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.app-input-control:focus {
  outline: 0;
  border-color: #1f4ba3;
  box-shadow: 0 0 0 3px rgba(31, 75, 163, 0.12);
  background: #fff;
}

.app-input-control::placeholder {
  color: #8a94a6;
  opacity: 1;
}

.app-input-with-icon .app-input-control {
  padding-left: 42px;
}

.app-input-icon {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
  color: #667085;
  font-size: 22px;
  pointer-events: none;
}

.app-input-dense .app-input-control {
  min-height: 46px;
}

.app-input-disabled .app-input-control {
  color: #8a94a6;
  cursor: not-allowed;
}
</style>
