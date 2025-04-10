<template>
  <q-item v-if="to && show" clickable :to="to">
    <q-item-section v-if="icon" avatar>
      <q-icon :name="icon" />
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ title }}</q-item-label>
      <q-item-label caption>{{ caption }}</q-item-label>
    </q-item-section>
  </q-item>
  <q-item v-else-if="action && show" clickable @click="action">
    <q-item-section v-if="icon" avatar>
      <q-icon :name="icon" />
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ title }}</q-item-label>
      <q-item-label caption>{{ caption }}</q-item-label>
    </q-item-section>
  </q-item>
  <q-expansion-item v-else-if="show" dense class="settingsClass" :icon="icon" :label="title">
    <q-card>
      <q-card-section>
        <q-select
          ref="languageRef"
          emit-value
          map-options
          options-dense
          style="min-width: 150px; padding: 0 10px"
          :label="$t('Language')"
          v-model="locale"
          :options="localeOptions"
          @popup-hide="blur"
        >
          <template v-slot:prepend>
            <q-icon name="translate" />
          </template>
        </q-select>
      </q-card-section>
    </q-card>
  </q-expansion-item>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    required: true,
  },

  caption: {
    type: String,
    default: '',
  },

  link: {
    type: String,
    default: '#',
  },

  icon: {
    type: String,
    default: '',
  },
})
console.log('EssentialLink', props)
</script>
<style lang="scss">
.q-expansion-item__container {
  .q-item.q-item-type.q-item--dense.q-item--clickable {
    min-height: 48px !important;
  }
}
</style>
