import { api } from 'boot/axios'

export const updateProfile = async (params) => {
  const response = await api.put(`profile/${params.id}`, params)
  return response.data
}

export const uploadProfilePicture = async (formData) => {
  const response = await api.post(`profile/picture/`, formData)
  return response.data
}
