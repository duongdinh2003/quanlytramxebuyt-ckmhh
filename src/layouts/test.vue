<template>
  <q-layout view="hHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>{{ $t('Danang Bus Stop WEBGIS') }}</q-toolbar-title>
        <q-btn color="primary" :label="$t('Add bus stop')" @click="openAddDialog" v-if="isAdmin" />
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
        <q-item-label header>{{ $t('Search bus stop') }}</q-item-label>
        <q-item>
          <q-item-section>
            <q-input
              v-model="searchBusStopName"
              :label="$t('Enter bus stop name')"
              dense
              @keyup.enter="searchBusStop"
            />
            <q-btn color="primary" class="q-mt-sm" :label="$t('Search')" @click="searchBusStop" />
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
            {{ 'Không tìm thấy trạm xe nào' }}
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <div id="map" class="map-container" v-if="isMapRoute"></div>
      <router-view v-else />
    </q-page-container>
  </q-layout>

  <!-- Dialog thêm trạm xe -->
  <q-dialog v-model="addDialog" persistent>
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">{{ $t('Add new bus stop') }}</div>
      </q-card-section>

      <q-card-section>
        <q-input v-model="newBusStop.name" :label="$t('Bus stop name')" dense />
        <q-input
          v-model="newBusStop.description"
          :label="$t('Description')"
          dense
          class="q-mt-sm"
        />
        <div class="text-caption q-mt-sm">
          {{ $t('Location') }}: {{ selectedPosition.lat }}, {{ selectedPosition.lng }}
        </div>
        <div class="text-caption q-mt-sm text-grey">
          {{ $t('Select a location on the map by clicking the "Select location" button') }}
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('Cancel')" color="primary" v-close-popup />
        <q-btn
          flat
          :label="$t('Select location')"
          color="secondary"
          @click="startSelectingLocation"
          v-close-popup
        />
        <q-btn
          flat
          :label="$t('Save')"
          color="primary"
          @click="addBusStop"
          :disable="!isValidBusStop"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Dialog sửa trạm xe -->
  <q-dialog v-model="editDialog" persistent>
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">{{ $t('Edit bus stop information') }}</div>
      </q-card-section>

      <q-card-section>
        <q-input v-model="editingBusStop.properties.name" :label="$t('Bus stop name')" dense />
        <q-input
          v-model="editingBusStop.properties.description"
          :label="$t('Description')"
          dense
          class="q-mt-sm"
        />
        <div class="text-caption q-mt-sm">
          {{ $t('Location') }}: {{ editingPosition.lat }}, {{ editingPosition.lng }}
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('Cancel')" color="primary" v-close-popup />
        <q-btn
          flat
          :label="$t('Update location')"
          color="secondary"
          @click="startEditingLocation"
          v-close-popup
        />
        <q-btn flat :label="$t('Save')" color="primary" @click="updateBusStop" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Dialog xác nhận xóa -->
  <q-dialog v-model="deleteDialog" persistent>
    <q-card>
      <q-card-section class="row items-center">
        <q-avatar icon="delete" color="negative" text-color="white" />
        <span class="q-ml-sm">{{ $t('Are you sure you want to delete this bus stop?') }}</span>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('Cancel')" color="primary" v-close-popup />
        <q-btn flat :label="$t('Delete')" color="negative" @click="deleteBusStop" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
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
    const isAdmin = computed(() => userStore.getUser?.role === 'ADMIN')

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
    const searchBusStopName = ref('')
    const searchResults = ref([])
    const searchError = ref('')
    let map
    let busStopsLayer
    let tempMarker = null

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

    const isMapRoute = computed(() => route.path === '/map')

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
        searchError.value = `${$t('Error adding bus stop')}: ${error.message}`
      }
    }

    const updateBusStop = async () => {
      try {
        if (!editingBusStop.value || !editingBusStop.value.properties.id) {
          throw new Error('Missing Bus Stop ID')
        }

        const id = editingBusStop.value.properties.id
        const payload = {
          name: editingBusStop.value.properties.name,
          geom: {
            type: 'Point',
            coordinates: [editingPosition.value.lng, editingPosition.value.lat],
          },
          description: editingBusStop.value.properties.description || null,
          image: editingBusStop.value.properties.image || null,
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
        searchError.value = `${$t('Error updating bus stop')}: ${error.message}`
      }
    }

    const deleteBusStop = async () => {
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
        searchError.value = `${$t('Error deleting bus stop')}: ${error.message}`
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
        // console.log('Raw data from API:', data)

        // Clear existing bus stops
        busStopsLayer.clearLayers()

        // Chuyển đổi dữ liệu thành định dạng GeoJSON
        if (Array.isArray(data)) {
          const geoJsonData = {
            type: 'FeatureCollection',
            features: data.map((stop) => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [stop.lng, stop.lat],
              },
              properties: {
                id: stop.id,
                name: stop.name,
                description: stop.description || '',
                image: stop.image,
              },
            })),
          }

          // console.log('Converted GeoJSON:', geoJsonData)
          busStopsLayer.addData(geoJsonData)

          // Kiểm tra xem có layer nào được thêm vào không
          let count = 0
          busStopsLayer.eachLayer(() => {
            count++
          })
          console.log(`Added ${count} bus stops to the map`)
        } else {
          console.error('Data is not an array:', data)
        }
      } catch (error) {
        console.error('Error fetching bus stops:', error)
        searchError.value = `${$t('Error loading data')}: ${error.message}`
      }
    }

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
          // Tạo nội dung popup tùy thuộc vào quyền admin
          let popupContent = `
            <b>${$t('Bus stop name')}:</b> ${props.name || $t('No name')}<br>
            <b>Mô tả:</b> ${props.description || $t('No description')}<br>
          `

          // Thêm các nút chỉ khi user là admin
          if (role === 'ADMIN') {
            popupContent += `
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
            `
          }
          layer.bindPopup(popupContent)
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

      // Đảm bảo map container có z-index phù hợp
      document.getElementById('map').style.zIndex = '1'

      // Đảm bảo drawer có z-index cao hơn
      const drawer = document.querySelector('.q-drawer')
      if (drawer) {
        drawer.style.zIndex = '1000'
      }
    }

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
            $t('No bus stop found with name containing "') + searchBusStopName.value + '".'
        }
      } catch (error) {
        console.error('Error searching bus stops:', error)
        searchError.value = `${$t('Error searching')}: ${error.message}`
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
      vm,
      essentialLinks: linksList,
      adminInteraction,
      userIntecraction,
      leftDrawerOpen,
      miniState,
      profile,
      isAdmin,
      toggleLeftDrawer() {
        leftDrawerOpen.value = !leftDrawerOpen.value
      },
      isMapRoute,
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
      openAddDialog,
      openEditDialog,
      confirmDelete,
      startSelectingLocation,
      startEditingLocation,
      addBusStop,
      updateBusStop,
      deleteBusStop,
      fetchBusStops,
      isValidBusStop,
      editingPosition,
    }
  },
})
</script>

<style scoped>
.map-container {
  height: calc(100vh - 50px);
  width: 100%;
}
</style>
