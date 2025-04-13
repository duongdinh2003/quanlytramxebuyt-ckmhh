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
    let searchLayer = null
    // Khai báo busStopIcon ở phạm vi setup
    const busStopIcon = L.icon({
      iconUrl: '/icons/bus-stop.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30],
    })

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

    // Tạo Search Control
    L.Control.SearchControl = L.Control.extend({
      onAdd: function () {
        // Xóa tham số map
        const container = L.DomUtil.create('div', 'search-control leaflet-bar')
        container.style.background = 'rgba(255, 255, 255, 0.5)'
        container.style.padding = '5px'
        container.style.borderRadius = '4px'
        container.style.boxShadow = '0 1px 5px rgba(255, 255, 255, 0.5)'
        container.style.border = '2px solid rgba(255, 255, 255, 0.5)'
        container.style.width = '300px'

        const input = L.DomUtil.create('input', 'search-input', container)
        input.type = 'text'
        input.placeholder = $t('Enter bus stop name')
        input.style.padding = '5px'
        input.style.margin = '5px'
        input.style.width = '220px'
        input.style.border = 'none'
        input.style.outline = 'none'

        const button = L.DomUtil.create('button', 'search-button', container)
        button.innerHTML = $t('Search')
        button.style.padding = '5px 14px'
        button.style.marginLeft = '5px'
        button.style.background = '#1976D2'
        button.style.color = 'white'
        button.style.border = 'none'
        button.style.borderRadius = '4px'
        button.style.cursor = 'pointer'

        // Danh sách kết quả tìm kiếm
        const resultsContainer = L.DomUtil.create('div', 'search-results', container)
        resultsContainer.style.display = 'none'
        resultsContainer.style.background = 'rgba(255, 255, 255, 0.5)'
        resultsContainer.style.maxHeight = '200px'
        resultsContainer.style.overflowY = 'auto'
        resultsContainer.style.borderTop = '1px solid #ddd'
        resultsContainer.style.marginTop = '5px'

        // Ngăn sự kiện map bị kích hoạt
        L.DomEvent.disableClickPropagation(container)

        // Gắn sự kiện
        L.DomEvent.on(input, 'input', (e) => {
          this._inputValue = e.target.value
        })

        L.DomEvent.on(button, 'click', () => {
          if (this._inputValue) {
            this.options.onSearch(this._inputValue, resultsContainer)
          }
        })

        L.DomEvent.on(input, 'keypress', (e) => {
          if (e.key === 'Enter' && this._inputValue) {
            this.options.onSearch(this._inputValue, resultsContainer)
          }
        })

        return container
      },

      onRemove: function () {
        // Cleanup if needed
      },
    })

    L.control.searchControl = function (opts) {
      return new L.Control.SearchControl(opts)
    }

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
        fetchBusStops()

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
        busStopsLayer.clearLayers()

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

          busStopsLayer.addData(geoJsonData)
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

    watch(
      isMapRoute,
      (newVal) => {
        if (newVal) {
          setTimeout(() => {
            initMap()
          }, 100)
        }
      },
      { immediate: true },
    )

    function initMap() {
      if (!document.getElementById('map')) return

      map = L.map('map', {
        center: [16.074, 108.224],
        zoom: 12,
        zoomControl: false,
        layers: [],
      })

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Thêm Search Control
      const searchControl = L.control.searchControl({
        position: 'topleft',
        onSearch: (value, resultsContainer) => {
          searchBusStopName.value = value
          searchBusStop(resultsContainer)
        },
      })
      searchControl.addTo(map)

      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      })

      const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20,
      })

      const vietnamBoundary = L.tileLayer.wms('http://localhost:8081/geoserver/Bus_Stop/wms', {
        layers: 'Bus_Des:mapvn_hashed',
        format: 'image/png',
        transparent: true,
        opacity: 1.0,
      })

      const danangBoundary = L.tileLayer.wms('http://localhost:8081/geoserver/Bus_Stop/wms', {
        layers: 'Bus_Des:mapdn',
        format: 'image/png',
        transparent: true,
        opacity: 1.0,
      })

      busStopsLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => L.marker(latlng, { icon: busStopIcon }),
        onEachFeature: (feature, layer) => {
          const props = feature.properties
          let popupContent = `
            <b>${$t('Bus stop name')}:</b> ${props.name || $t('No name')}<br>
            <b>${$t('Description')}:</b> ${props.description || $t('No description')}<br>
          `

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

      fetchBusStops()

      const baseLayers = {
        OpenStreetMap: osmLayer,
        Satellite: satelliteLayer,
      }

      const overlayLayers = {
        'Ranh giới Việt Nam': vietnamBoundary,
        'Ranh giới Đà Nẵng': danangBoundary,
        'Trạm xe bus': busStopsLayer,
      }

      osmLayer.addTo(map)
      vietnamBoundary.addTo(map)
      danangBoundary.addTo(map)
      busStopsLayer.addTo(map)

      L.control.layers(baseLayers, overlayLayers).addTo(map)

      document.getElementById('map').style.zIndex = '1'
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

    const searchBusStop = async (resultsContainer) => {
      searchError.value = ''
      searchResults.value = []

      if (!searchBusStopName.value.trim()) {
        resultsContainer.style.display = 'none'
        if (searchLayer) {
          map.removeLayer(searchLayer)
          searchLayer = null
        }
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

          // Xóa layer tìm kiếm cũ
          if (searchLayer) {
            map.removeLayer(searchLayer)
          }

          // Tạo layer mới cho kết quả tìm kiếm
          searchLayer = L.geoJSON(data.features, {
            pointToLayer: (feature, latlng) => L.marker(latlng, { icon: busStopIcon }), // Sử dụng busStopIcon đã khai báo
            onEachFeature: (feature, layer) => {
              const props = feature.properties
              let popupContent = `
                <b>${$t('Bus stop name')}:</b> ${props.name}<br>
                <b>${$t('Description')}:</b> ${props.description || $t('No description')}<br>
              `
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
          }).addTo(map)

          // Hiển thị danh sách kết quả
          resultsContainer.innerHTML = ''
          data.features.forEach((feature) => {
            const item = L.DomUtil.create('div', 'search-result-item', resultsContainer)
            item.style.padding = '5px'
            item.style.cursor = 'pointer'
            item.style.borderBottom = '1px solid #eee'
            item.innerHTML = `
              <div><b>${feature.properties.name}</b></div>
              <div style="font-size: 0.8em; color: #666;">${feature.properties.description || ''}</div>
            `
            L.DomEvent.on(item, 'click', () => {
              const [lng, lat] = feature.geometry.coordinates
              map.flyTo([lat, lng], 16)
              searchLayer.eachLayer((layer) => {
                if (layer.feature.properties.id === feature.properties.id) {
                  layer.openPopup()
                }
              })
              resultsContainer.style.display = 'none'
            })
          })
          resultsContainer.style.display = 'block'

          // Di chuyển bản đồ đến kết quả đầu tiên
          if (data.features[0].geometry.coordinates) {
            const [lng, lat] = data.features[0].geometry.coordinates
            map.flyTo([lat, lng], 16)
          }
        } else {
          searchError.value =
            $t('No bus stop found with name containing "') + searchBusStopName.value + '".'
          resultsContainer.innerHTML = `<div style="padding: 5px; color: red;">${searchError.value}</div>`
          resultsContainer.style.display = 'block'
        }
      } catch (error) {
        console.error('Error searching bus stops:', error)
        searchError.value = `${$t('Error searching')}: ${error.message}`
        resultsContainer.innerHTML = `<div style="padding: 5px; color: red;">${searchError.value}</div>`
        resultsContainer.style.display = 'block'
      }
    }

    const panToBusStop = (busStop) => {
      if (busStop && busStop.geometry && busStop.geometry.coordinates) {
        const [lng, lat] = busStop.geometry.coordinates
        map.flyTo([lat, lng], 16)
        busStopsLayer.eachLayer((layer) => {
          if (layer.feature.properties.id === busStop.properties.id) {
            layer.openPopup()
          }
        })
      }
    }

    return {
      vm,
      essentialLinks: linksList,
      adminInteraction,
      userIntecraction,
      leftDrawerOpen,
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
      </q-list>
    </q-drawer>

    <q-page-container>
      <div id="map" class="map-container" v-if="isMapRoute"></div>
      <router-view v-else />
    </q-page-container>

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
  </q-layout>
</template>

<style scoped>
.map-container {
  height: calc(100vh - 50px);
  width: 100%;
}

.search-control {
  background: rgba(0, 0, 0, 0.5) !important;
  border-radius: 4px;
  width: 300px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 10px;
}

.search-button {
  background: #1976d2;
  color: white;
  border: none;
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 4px;
}

.search-results {
  background: white;
  max-height: 200px;
  overflow-y: auto;
  border-top: 1px solid #ddd;
  margin-top: 5px;
}

.search-result-item {
  padding: 5px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
}

.search-result-item:hover {
  background: #f5f5f5;
}
</style>
