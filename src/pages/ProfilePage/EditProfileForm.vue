<template>
  <q-card class="myCardClass" flat bordered>
    <q-card-section horizontal class="row">
      <q-card-section class="q-pt-xs inputClass col-8">
        <div class="text-h4">{{ $t('Profile') }}</div>
        <div class="text-h6">{{ $t('Basic information') }}</div>
        <q-card-section horizontal>
          <q-input :label="$t('First Name')" v-model="userProfile.given_name" />
          <q-input :label="$t('Last Name')" v-model="userProfile.family_name" />
          <!-- <q-input :label="$t('Date of Birth')" v-model="userProfile.birthday" />
          <q-input :label="$t('Gender')" v-model="userProfile.gender" /> -->
          <q-input
            :label="$t('Date of Birth')"
            v-model="userProfile.birthday"
            mask="date"
            :rules="['date']"
          >
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="userProfile.birthday">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Close" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-select
            :label="$t('Gender')"
            v-model="userProfile.gender"
            :options="genderOptions"
            emit-value
            map-options
          />
        </q-card-section>
        <div class="text-h6">{{ $t('Communicate information') }}</div>
        <q-card-section horizontal>
          <q-input :label="$t('Email')" v-model="userProfile.email" />
          <q-input :label="$t('Phone Number')" v-model="userProfile.phone_number" />
        </q-card-section>
        <q-card-section horizontal>
          <q-input :label="$t('Address')" v-model="userProfile.address" />
          <q-input :label="$t('Current Location')" v-model="userProfile.current_location" />
        </q-card-section>
      </q-card-section>
      <q-separator vertical />
      <q-card-section class="col-4 flex flex-center column profile-image-section">
        <div class="image-container">
          <q-img
            class="rounded-borders user-avatar"
            :src="imagePreview || userProfile.picture"
            fit="cover"
          />
        </div>
        <div class="upload-btn-wrapper q-mt-md">
          <q-btn color="primary" :label="$t('Change Photo')" @click="triggerFileInput" />
          <input
            type="file"
            ref="fileInput"
            accept="image/*"
            style="display: none"
            @change="onFileSelected"
          />
        </div>
      </q-card-section>
    </q-card-section>

    <q-separator />

    <q-card-actions class="justify-center">
      <q-btn flat color="primary" style="width: 100%" @click="submit">
        {{ $t('Submit') }}
      </q-btn>
    </q-card-actions>
  </q-card>
</template>
<script>
import {
  defineComponent,
  ref,
  unref,
  // onMounted,
  // getCurrentInstance,
} from 'vue'
import { useUserStore } from 'stores/user'
import { updateProfile, uploadProfilePicture } from 'src/api/profile'
import _isEqual from 'lodash/isEqual'
import _cloneDeep from 'lodash/cloneDeep'
import { useQuasar } from 'quasar'
import { i18n } from 'src/boot/i18n'

export default defineComponent({
  name: 'EditProfileForm',
  setup() {
    const $q = useQuasar()
    const $t = i18n.global.t
    const userstore = useUserStore()
    const user = userstore.getUser
    const userProfile = ref(_cloneDeep(user.profile))
    const fileInput = ref(null)
    const selectedFile = ref(null)
    const imagePreview = ref(null)
    const loading = ref(false)

    // Options cho gender select
    const genderOptions = [
      { label: $t('Male'), value: 'MALE' },
      { label: $t('Female'), value: 'FEMALE' },
      { label: $t('Other'), value: 'OTHER' },
    ]

    const triggerFileInput = () => {
      fileInput.value.click()
    }

    const onFileSelected = (event) => {
      const file = event.target.files[0]
      if (file) {
        selectedFile.value = file
        // Tạo URL cho file đã chọn để hiển thị preview
        imagePreview.value = URL.createObjectURL(file)
      }
    }

    const submit = async () => {
      loading.value = true
      try {
        let updatedProfile = { ...unref(userProfile) }

        // Nếu có file ảnh được chọn, xử lý upload ảnh
        if (selectedFile.value) {
          const formData = new FormData()
          formData.append('picture', selectedFile.value)

          // Gọi API upload ảnh
          const uploadResponse = await uploadProfilePicture(formData)

          // Nếu upload thành công, cập nhật đường dẫn ảnh mới vào profile
          if (uploadResponse && uploadResponse.imageUrl) {
            updatedProfile.picture = uploadResponse.imageUrl
          }
        }

        // Kiểm tra xem profile có thay đổi không
        if (!_isEqual(updatedProfile, userstore.getUser.profile)) {
          const response = await updateProfile({ id: user.id, profile: updatedProfile })
          userstore.setProfile(response)
          // Giải phóng object URL để tránh rò rỉ bộ nhớ
          if (imagePreview.value) {
            URL.revokeObjectURL(imagePreview.value)
            imagePreview.value = null
          }

          // Hiển thị thông báo thành công nếu bạn dùng Quasar Notify
          $q.notify({
            color: 'positive',
            message: 'Profile updated successfully',
            icon: 'check',
          })
        }
      } catch (e) {
        console.log('Error updating profile:', e)
        // Hiển thị thông báo lỗi
        $q.notify({
          color: 'negative',
          message: 'Failed to update profile',
          icon: 'error',
        })
      } finally {
        loading.value = false
        // Reset selected file and image preview
        selectedFile.value = null
      }
    }
    return {
      userProfile,
      fileInput,
      imagePreview,
      genderOptions,
      loading,
      triggerFileInput,
      onFileSelected,
      submit,
    }
  },
})
</script>
<style lang="scss" scoped>
.inputClass {
  .q-card__section--horiz {
    gap: 50px;
    margin-bottom: 5px;
  }
}

.profile-image-section {
  padding: 20px;
}

.image-container {
  width: 250px;
  height: 250px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 50%;
}

.user-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-btn-wrapper {
  margin-top: 20px;
  text-align: center;
}

/* Sửa lỗi responsive cho input fields */
@media (max-width: 1200px) {
  .q-card__section--horiz {
    flex-wrap: wrap;

    .q-input,
    .q-select {
      width: 100%;
      margin-bottom: 10px;
    }
  }
}
</style>
