<template>
  <div>
    <q-layout view="lHh Lpr lFf">
      <q-header elevated>
        <q-toolbar>
          <q-btn flat dense round icon="menu" @click="toggleLeftDrawer" />
          <q-toolbar-title>WebGIS Trạm Xe Bus Đà Nẵng</q-toolbar-title>
          <q-btn color="primary" label="Thêm trạm xe" @click="openAddDialog" v-if="isAdmin" />
        </q-toolbar>
      </q-header>

      <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
        <q-list>
          <q-item-label header>Chức năng</q-item-label>
          <q-item>
            <q-item-section>
              <p>Chào mừng bạn đến với WebGIS Đà Nẵng!</p>
              <p>Bản đồ hiển thị thông tin các trạm xe bus trong khu vực Thành Phố Đà Nẵng.</p>
            </q-item-section>
          </q-item>
          <q-item-label header>Tìm kiếm trạm xe</q-item-label>
          <q-item>
            <q-item-section>
              <q-input
                v-model="searchBusStopName"
                label="Nhập tên trạm xe"
                dense
                @keyup.enter="searchBusStop"
              />
              <q-btn color="primary" class="q-mt-sm" label="Tìm" @click="searchBusStop" />
            </q-item-section>
          </q-item>
          <q-item v-if="searchResults.length > 0">
            <q-item-section>
              <q-list bordered separator>
                <q-item
                  v-for="(result, index) in searchResults"
                  :key="index"
                  clickable
                  @click="panToBusStop(result)"
                >
                  <q-item-section>{{ result.properties.name }}</q-item-section>
                  <q-item-section side>
                    <q-btn flat round dense icon="edit" @click.stop="openEditDialog(result)" />
                    <q-btn
                      flat
                      round
                      dense
                      icon="delete"
                      color="negative"
                      @click.stop="confirmDelete(result)"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-item-section>
          </q-item>
          <q-item v-if="searchError">
            <q-item-section class="text-negative">
              {{ searchError }}
            </q-item-section>
          </q-item>
        </q-list>
      </q-drawer>

      <q-page-container>
        <div id="map" class="map-container"></div>
      </q-page-container>
    </q-layout>

    <!-- Dialog thêm trạm xe -->
    <q-dialog v-model="addDialog" persistent v-if="isAdmin">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Thêm trạm xe mới</div>
        </q-card-section>

        <q-card-section>
          <q-input v-model="newBusStop.name" label="Tên trạm xe" dense />
          <q-input v-model="newBusStop.description" label="Mô tả" dense class="q-mt-sm" />
          <div class="text-caption q-mt-sm">
            Vị trí: {{ selectedPosition.lat }}, {{ selectedPosition.lng }}
          </div>
          <div class="text-caption q-mt-sm text-grey">
            Chọn vị trí trên bản đồ bằng cách nhấn vào nút "Chọn vị trí"
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Hủy" color="primary" v-close-popup />
          <q-btn
            flat
            label="Chọn vị trí"
            color="secondary"
            @click="startSelectingLocation"
            v-close-popup
          />
          <q-btn flat label="Lưu" color="primary" @click="addBusStop" :disable="!isValidBusStop" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog sửa trạm xe -->
    <q-dialog v-model="editDialog" persistent v-if="isAdmin">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Sửa thông tin trạm xe</div>
        </q-card-section>

        <q-card-section>
          <q-input v-model="editingBusStop.properties.name" label="Tên trạm xe" dense />
          <q-input
            v-model="editingBusStop.properties.description"
            label="Mô tả"
            dense
            class="q-mt-sm"
          />
          <div class="text-caption q-mt-sm">
            Vị trí: {{ editingPosition.lat }}, {{ editingPosition.lng }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Hủy" color="primary" v-close-popup />
          <q-btn
            flat
            label="Cập nhật vị trí"
            color="secondary"
            @click="startEditingLocation"
            v-close-popup
          />
          <q-btn flat label="Lưu" color="primary" @click="updateBusStop" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog xác nhận xóa -->
    <q-dialog v-model="deleteDialog" persistent v-if="isAdmin">
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="delete" color="negative" text-color="white" />
          <span class="q-ml-sm">Bạn có chắc chắn muốn xóa trạm xe này?</span>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Hủy" color="primary" v-close-popup />
          <q-btn flat label="Xóa" color="negative" @click="deleteBusStop" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { i18n } from 'boot/i18n.js'
import { useUserStore } from 'stores/user'
import { useQuasar } from 'quasar'

export default {
  name: 'MainLayout',
  setup() {
    const $t = i18n.global.t
    const $q = useQuasar()
    const userStore = useUserStore()
    const leftDrawerOpen = ref(true)
    const searchBusStopName = ref('')
    const searchResults = ref([])
    const searchError = ref('')
    let map
    let busStopsLayer
    let tempMarker = null
    const role = computed(() => userStore.getUser?.role || 'USER')
    const isAdmin = computed(() => role.value === 'ADMIN')

    const checkPermission = () => {
      if (!isAdmin.value) {
        $q.notify({
          type: 'negative',
          message: 'Bạn không có quyền thực hiện hành động này',
        })
        return false
      }
      return true
    }

    // Dialog states
    const addDialog = ref(false)
    const editDialog = ref(false)
    const deleteDialog = ref(false)

    // Bus Stop data
    const newBusStop = ref({
      name: '',
      description: '',
      geom: null,
    })

    const selectedPosition = ref({ lat: '', lng: '' })
    const editingBusStop = ref(null)
    const editingPosition = ref({ lat: '', lng: '' })
    const busStopToDelete = ref(null)

    const isValidBusStop = computed(() => {
      return (
        newBusStop.value.name &&
        selectedPosition.value.lat !== '' &&
        selectedPosition.value.lng !== ''
      )
    })

    const openAddDialog = () => {
      newBusStop.value = {
        name: '',
        description: '',
        geom: null,
      }
      selectedPosition.value = { lat: '', lng: '' }
      addDialog.value = true
    }

    const openEditDialog = (busStop) => {
      editingBusStop.value = JSON.parse(JSON.stringify(busStop))

      // Extract coordinates
      if (busStop.geometry && busStop.geometry.coordinates) {
        const [lng, lat] = busStop.geometry.coordinates
        editingPosition.value = { lat, lng }
      }

      editDialog.value = true
    }

    const confirmDelete = (busStop) => {
      busStopToDelete.value = busStop
      deleteDialog.value = true
    }

    const startSelectingLocation = () => {
      map.once('click', (e) => {
        selectedPosition.value = { lat: e.latlng.lat, lng: e.latlng.lng }

        newBusStop.value.latitude = e.latlng.lat
        newBusStop.value.longitude = e.latlng.lng

        // Add temporary marker
        if (tempMarker) {
          map.removeLayer(tempMarker)
        }
        tempMarker = L.marker(e.latlng).addTo(map)

        addDialog.value = true
      })
    }

    const startEditingLocation = () => {
      map.once('click', (e) => {
        editingPosition.value = { lat: e.latlng.lat, lng: e.latlng.lng }

        // Update GeoJSON for the edited bus stop
        if (editingBusStop.value) {
          editingBusStop.value.geometry.coordinates = [e.latlng.lng, e.latlng.lat]
        }

        editDialog.value = true
      })
    }

    const addBusStop = async () => {
      if (!checkPermission()) return
      try {
        const payload = {
          name: newBusStop.value.name,
          description: newBusStop.value.description || null,
          latitude: newBusStop.value.latitude,
          longitude: newBusStop.value.longitude,
        }

        const response = await fetch('http://localhost:3000/api/bus-stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        await response.json()

        // Reload the bus stops data
        fetchBusStops()

        // Clear temp marker
        if (tempMarker) {
          map.removeLayer(tempMarker)
          tempMarker = null
        }

        addDialog.value = false
      } catch (error) {
        console.error('Error adding bus stop:', error)
        searchError.value = `Lỗi thêm trạm xe: ${error.message}`
      }
    }

    const updateBusStop = async () => {
      if (!checkPermission()) return
      try {
        if (!editingBusStop.value || !editingBusStop.value.properties.id) {
          throw new Error('Missing Bus Stop ID')
        }

        const id = editingBusStop.value.properties.id
        const payload = {
          name: editingBusStop.value.properties.name,
          description: editingBusStop.value.properties.description || null,
          geom: {
            type: 'Point',
            coordinates: [editingPosition.value.lng, editingPosition.value.lat],
          },
        }

        const response = await fetch(`http://localhost:3000/api/bus-stop/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        // Reload the bus stops data
        fetchBusStops()

        editDialog.value = false
      } catch (error) {
        console.error('Error updating bus stop:', error)
        searchError.value = `Lỗi cập nhật trạm xe: ${error.message}`
      }
    }

    const deleteBusStop = async () => {
      if (!checkPermission()) return
      try {
        if (!busStopToDelete.value || !busStopToDelete.value.properties.id) {
          throw new Error('Missing bus stop ID')
        }

        const id = busStopToDelete.value.properties.id
        const response = await fetch(`http://localhost:3000/api/bus-stop/${id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        // Reload the bus stops data
        fetchBusStops()

        searchResults.value = searchResults.value.filter(
          (r) => r.properties.id !== busStopToDelete.value.properties.id,
        )

        busStopToDelete.value = null
      } catch (error) {
        console.error('Error deleting bus stop:', error)
        searchError.value = `Lỗi xóa trạm xe: ${error.message}`
      }
    }

    const fetchBusStops = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/bus-stop', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        // Clear existing bus stops
        busStopsLayer.clearLayers()

        // Add new data
        busStopsLayer.addData(data)
      } catch (error) {
        console.error('Error fetching bus stops:', error)
        searchError.value = `Lỗi tải dữ liệu: ${error.message}`
      }
    }

    onMounted(() => {
      // Khởi tạo bản đồ
      map = L.map('map', {
        center: [16.074, 108.224],
        zoom: 12,
        layers: [],
      })

      // Định nghĩa các lớp nền
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      })

      const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20,
      })

      // Định nghĩa các lớp phủ
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

      busStopsLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => L.marker(latlng, { icon: busStopIcon }),
        onEachFeature: (feature, layer) => {
          const props = feature.properties
          layer.bindPopup(`
                <b>${$t('Bus stop name')}:</b> ${props.name || $t('No name')}<br>
                <b>Mô tả:</b> ${props.description || $t('No description')}<br>
                <div style="margin-top: 10px;">
                  <button
                    onclick="document.dispatchEvent(new CustomEvent('edit-bus-stop', {detail: ${props.id}}))"
                    style="background-color: #1976D2; color: white; border: none; padding: 5px 10px; margin-right: 5px; cursor: pointer;"
                  >
                    ${$t('Edit')}
                  </button>
                  <button
                    onclick="document.dispatchEvent(new CustomEvent('delete-bus-stop', {detail: ${props.id}}))"
                    style="background-color: #C10015; color: white; border: none; padding: 5px 10px; cursor: pointer;"
                  >
                    ${$t('Delete')}
                  </button>
                </div>
              `)
        },
      })

      // Event listeners for popup actions
      document.addEventListener('edit-bus-stop', (e) => {
        const id = e.detail
        const busStop = findBusStopById(id)
        if (busStop) {
          openEditDialog(busStop)
        }
      })

      document.addEventListener('delete-bus-stop', (e) => {
        const id = e.detail
        const busStop = findBusStopById(id)
        if (busStop) {
          confirmDelete(busStop)
        }
      })

      // Tải dữ liệu từ API backend
      fetchBusStops()

      // Nhóm lớp nền và lớp phủ
      const baseLayers = {
        OpenStreetMap: osmLayer,
        Satellite: satelliteLayer,
      }

      const overlayLayers = {
        'Ranh giới Việt Nam': vietnamBoundary,
        'Ranh giới Đà Nẵng': danangBoundary,
        'Trạm xe bus': busStopsLayer,
      }

      // Thêm lớp nền và lớp phủ
      osmLayer.addTo(map)
      vietnamBoundary.addTo(map)
      danangBoundary.addTo(map)
      busStopsLayer.addTo(map)

      L.control.layers(baseLayers, overlayLayers).addTo(map)
    })

    const findBusStopById = (id) => {
      let found = null
      busStopsLayer.eachLayer((layer) => {
        if (layer.feature.properties.id === id) {
          found = layer.feature
        }
      })
      return found
    }

    const searchBusStop = async () => {
      searchError.value = ''
      if (!searchBusStopName.value.trim()) {
        searchResults.value = []
        return
      }

      try {
        const response = await fetch(
          `http://localhost:3000/api/bus-stop/${searchBusStopName.value}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          },
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        if (data.features && data.features.length > 0) {
          searchResults.value = data.features
        } else {
          searchResults.value = []
          searchError.value =
            'Không tìm thấy trạm xe nào có tên chứa "' + searchBusStopName.value + '".'
        }
      } catch (error) {
        console.error('Error searching bus stops:', error)
        searchError.value = `Lỗi tìm kiếm: ${error.message}`
        searchResults.value = []
      }
    }

    const panToBusStop = (busStop) => {
      if (busStop && busStop.geometry && busStop.geometry.coordinates) {
        const [longitude, latitude] = busStop.geometry.coordinates
        map.flyTo([latitude, longitude], 16)
        busStopsLayer.eachLayer((layer) => {
          if (layer.feature.properties.id === busStop.properties.id) {
            layer.openPopup()
          }
        })
      }
      leftDrawerOpen.value = false
    }

    return {
      leftDrawerOpen,
      toggleLeftDrawer: () => (leftDrawerOpen.value = !leftDrawerOpen.value),
      searchBusStopName,
      searchResults,
      searchError,
      searchBusStop,
      panToBusStop,
      addDialog,
      editDialog,
      deleteDialog,
      newBusStop,
      selectedPosition,
      editingBusStop,
      editingPosition,
      openAddDialog,
      openEditDialog,
      confirmDelete,
      startSelectingLocation,
      startEditingLocation,
      addBusStop,
      updateBusStop,
      deleteBusStop,
      isValidBusStop,
    }
  },
}
</script>

<style scoped>
.map-container {
  height: calc(100vh - 50px);
  width: 100%;
}
</style>
