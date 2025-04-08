<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" @click="toggleLeftDrawer" />
        <q-toolbar-title>WebGIS Trạm Xe Buýt Đà Nẵng</q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
      <q-list>
        <q-item-label header>Chức năng</q-item-label>
        <q-item>
          <q-item-section>
            <p>Chào mừng bạn đến với WebGIS Đà Nẵng!</p>
            <p>Bản đồ hiển thị thông tin các trạm xe buýt trong khu vực Thành Phố Đà Nẵng.</p>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <div id="map" class="map-container"></div>
    </q-page-container>
  </q-layout>
</template>

<script>
import { ref, onMounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default {
  name: 'MainLayout',
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
      const vietnamBoundary = L.tileLayer.wms('http://localhost:8080/geoserver/Bus_Stop/wms', {
        layers: 'Bus_Stop:vnm___gadm41_vnm_1',
        format: 'image/png',
        transparent: true,
        opacity: 1.0,
      })

      const danangBoundary = L.tileLayer.wms('http://localhost:8080/geoserver/Bus_Stop/wms', {
        layers: 'Bus_Stop:da_nang___gadm41_vnm_1',
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
        'http://localhost:8080/geoserver/Bus_Stop/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Bus_Stop:bus_stops_da_nang&maxFeatures=1000&outputFormat=application/json',
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
