<template>
  <q-layout view="hHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>WebGIS Trạm Xe Buýt Đà Nẵng</q-toolbar-title>
        <q-avatar>
          <img v-if="profile?.picture" :src="profile?.picture" alt="picture" />
          <img v-else src="~assets/account.jpg" alt="picture" />
        </q-avatar>
      </q-toolbar>
    </q-header>
    <q-drawer v-model="leftDrawerOpen" show-if-above elevated side="left" behavior="desktop">
      <q-list>
        <EssentialLink v-for="link in essentialLinks" :key="link.title" v-bind="link" />
        <q-separator />
        <EssentialLink v-for="link in adminInteraction" :key="link.title" v-bind="link" />
        <q-separator />
        <EssentialLink v-for="link in userIntecraction" :key="link.title" v-bind="link" />
      </q-list>
    </q-drawer>

    <q-page-container>
      <div id="map" class="map-container" v-if="isMapRoute"></div>
      <router-view v-else />
    </q-page-container>
  </q-layout>
</template>

<script>
import { getCurrentInstance, defineComponent, ref, computed, onBeforeMount, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import EssentialLink from 'components/EssentialLink.vue'
import { i18n } from 'boot/i18n.js'
import { useUserStore } from 'stores/user'
import { useRoute, useRouter } from 'vue-router'

export default defineComponent({
  name: 'MainLayout',

  components: {
    EssentialLink,
  },

  setup() {
    const vm = getCurrentInstance().proxy
    const $t = i18n.global.t
    const router = useRouter()
    const route = useRoute()
    const userStore = useUserStore()
    const { role, profile } = userStore.getUser
    const leftDrawerOpen = ref(true)
    const miniState = ref(true)
    const linksList = computed(() => [
      {
        title: $t('Map'),
        icon: 'fa-sharp fa-solid fa-map-location-dot',
        to: '/map',
      },
    ])
    const adminInteraction = computed(() => [
      {
        title: $t('Users management'),
        icon: 'fa-solid fa-users',
        to: '/user-management',
        show: role === 'ADMIN',
      },
    ])
    const userIntecraction = computed(() => [
      {
        title: $t('Profile'),
        icon: 'account_circle',
        to: '/profile',
      },
      {
        title: $t('Settings'),
        icon: 'settings',
      },
      {
        title: $t('Logout'),
        icon: 'logout',
        action: () => {
          userStore.clearUser()
          router.push({ name: 'LoginPage' })
        },
      },
    ])
    let map
    const isMapRoute = computed(() => route.path === '/map')

    onBeforeMount(() => {
      if (route.path === '/') {
        router.replace({ name: 'HomePage' })
      }
    })

    // Theo dõi sự thay đổi của route và khởi tạo bản đồ khi cần
    watch(
      isMapRoute,
      (newVal) => {
        if (newVal) {
          // Đợi một chút để DOM được cập nhật
          setTimeout(() => {
            initMap()
          }, 100)
        }
      },
      { immediate: true },
    )

    function initMap() {
      if (!document.getElementById('map')) return

      // Khởi tạo bản đồ
      map = L.map('map', {
        center: [16.074, 108.224],
        zoom: 12,
        zoomControl: false,
        layers: [], // Không thêm lớp mặc định ngay
      })

      // Thêm zoomControl ở vị trí khác để tránh xung đột với drawer
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Định nghĩa các lớp nền (base layers)
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      })

      const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20,
      })

      // Định nghĩa các lớp phủ (overlay layers)
      const vietnamBoundary = L.tileLayer.wms('http://localhost:8080/geoserver/Bus_Stop/wms', {
        layers: 'Bus_Stop:mapvn_hashed',
        format: 'image/png',
        transparent: true,
        opacity: 1.0,
      })

      const danangBoundary = L.tileLayer.wms('http://localhost:8080/geoserver/Bus_Stop/wms', {
        layers: 'Bus_Stop:mapdn',
        format: 'image/png',
        transparent: true,
        opacity: 1.0,
      })

      const busStopIcon = L.icon({
        iconUrl: '/icons/bus-stop.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
      })

      const busStopsLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => L.marker(latlng, { icon: busStopIcon }),
        onEachFeature: (feature, layer) =>
          layer.bindPopup(`Địa chỉ trạm: ${feature.properties.name}`),
      })

      // Tải dữ liệu trạm xe buýt từ WFS
      fetch(
        'http://localhost:8080/geoserver/Bus_Stop/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Bus_Stop:bus_stops_da_nang&maxFeatures=1000&outputFormat=application%2Fjson',
      )
        .then((response) => response.json())
        .then((data) => {
          console.log(data)
          busStopsLayer.addData(data)
        })
        .catch((error) => console.error('Lỗi khi lấy trạm xe buýt:', error))

      // Nhóm lớp nền và lớp phủ
      const baseLayers = {
        OpenStreetMap: osmLayer,
        Satellite: satelliteLayer,
      }

      const overlayLayers = {
        'Ranh giới Việt Nam': vietnamBoundary,
        'Ranh giới Đà Nẵng': danangBoundary,
        'Trạm xe buýt': busStopsLayer,
      }

      // Thêm lớp nền mặc định và lớp phủ vào bản đồ
      osmLayer.addTo(map)
      vietnamBoundary.addTo(map)
      danangBoundary.addTo(map)
      busStopsLayer.addTo(map)

      // Thêm bộ điều khiển lớp
      L.control.layers(baseLayers, overlayLayers).addTo(map)

      // Đảm bảo map container có z-index phù hợp
      document.getElementById('map').style.zIndex = '1'

      // Đảm bảo drawer có z-index cao hơn
      const drawer = document.querySelector('.q-drawer')
      if (drawer) {
        drawer.style.zIndex = '1000'
      }
    }

    return {
      vm,
      essentialLinks: linksList,
      adminInteraction,
      userIntecraction,
      leftDrawerOpen,
      miniState,
      profile,
      toggleLeftDrawer() {
        leftDrawerOpen.value = !leftDrawerOpen.value
      },
      isMapRoute,
    }
  },
})
</script>
