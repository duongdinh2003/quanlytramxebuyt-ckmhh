<template>
  <q-list>
    <q-item-label header>Chức năng</q-item-label>

    <q-item clickable v-ripple to="/dashboard">
      <q-item-section avatar>
        <q-icon name="dashboard" />
      </q-item-section>
      <q-item-section> Dashboard </q-item-section>
    </q-item>

    <q-item clickable v-ripple to="/users">
      <q-item-section avatar>
        <q-icon name="add" />
      </q-item-section>
      <q-item-section> Thêm địa điểm </q-item-section>
    </q-item>

    <q-item clickable v-ripple to="/settings">
      <q-item-section avatar>
        <q-icon name="settings" />
      </q-item-section>
      <q-item-section> Cài đặt </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup></script>
