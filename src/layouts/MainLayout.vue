<template>
  <div>
    <q-layout view="lHh Lpr lFf">
      <q-header elevated>
        <q-toolbar>
          <q-btn flat dense round icon="menu" @click="toggleLeftDrawer" />
          <q-toolbar-title>WebGIS Trạm Xe Buýt Đà Nẵng</q-toolbar-title>
        </q-toolbar>
      </q-header>

      <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
        <!-- Hú hú khẹc khẹc -->
        <ItemsSection />
      </q-drawer>

      <q-page-container>
        <div id="map" class="map-container">
          <router-view />
        </div>
      </q-page-container>
    </q-layout>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ItemsSection from './components/ItemsSection.vue'

export default {
  name: 'MainLayout',
  components: {
    ItemsSection,
  },
  setup() {
    const leftDrawerOpen = ref(true)
    let map

    onMounted(() => {
      // Khởi tạo bản đồ
      map = L.map('map', {
        center: [16.074, 108.224],
        zoom: 12,
        layers: [], // Không thêm lớp mặc định ngay
      })

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
      const vietnamBoundary = L.tileLayer.wms('http://localhost:8081/geoserver/Bus_Stop/wms', {
        layers: 'Bus_Stop:mapvn_hashed',
        format: 'image/png',
        transparent: true,
        opacity: 1.0,
      })

      const danangBoundary = L.tileLayer.wms('http://localhost:8081/geoserver/Bus_Stop/wms', {
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
          layer.bindPopup(
            `Địa chỉ trạm: ${feature.properties.name}
             Địa chỉ trạm: ${feature.properties.name}`,
          ),
      })

      // Tải dữ liệu trạm xe buýt từ WFS
      fetch(
        'http://localhost:8081/geoserver/Bus_Stop/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Bus_Stop%3Ahighway_bus_stop__a_nang&maxFeatures=1000&outputFormat=application%2Fjson',
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
    })

    return {
      leftDrawerOpen,
      toggleLeftDrawer: () => (leftDrawerOpen.value = !leftDrawerOpen.value),
    }
  },
}
</script>
