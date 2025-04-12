import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default {
  /**
   * @swagger
   * /api/profile:
   *   post:
   *     tags:
   *       - Profiles
   *     summary: create a user profile
   *     parameters:
   *       - name: id
   *         in: path
   *         description: Profile ID
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Profile'
   *     responses:
   *       200:
   *         description: Profile create successfully
   *       404:
   *         description: Profile not found
   */
  create: async (req, res) => {
    const { profile } = req.body
    try {
      const data = await prisma.profile.create({
        data: {
          sub: profile.sub || undefined,
          email: profile.email || undefined,
          name: profile.name || undefined,
          given_name: profile.given_name || undefined,
          family_name: profile.family_name || undefined,
          picture: profile.picture || undefined,
          gender: profile.gender || undefined,
          address: profile.address || undefined,
          birthday: profile.birthday || undefined,
        },
      })
      res.json(data)
    } catch {
      res.status(400).json({ message: 'Profile create attempt failed!' })
    }
  },
  /**
   * @swagger
   * /api/profile/{id}:
   *   put:
   *     tags:
   *       - Profiles
   *     summary: Update a user profile by ID
   *     parameters:
   *       - name: id
   *         in: path
   *         description: Profile ID
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Profile'
   *     responses:
   *       200:
   *         description: Profile updated successfully
   *       404:
   *         description: Profile not found
   */
  update: async (req, res) => {
    const { profile } = req.body

    // Xử lý birthday
    let birthdayValue = undefined
    if (profile.birthday) {
      // Kiểm tra nếu birthday là chuỗi, chuyển thành Date
      birthdayValue = new Date(profile.birthday)

      // Kiểm tra tính hợp lệ của ngày
      if (isNaN(birthdayValue.getTime())) {
        return res.status(400).json({ message: 'Invalid birthday format!' })
      }
    }
    try {
      const data = await prisma.profile.update({
        where: {
          id: profile.id,
        },
        data: {
          sub: profile.sub || undefined,
          email: profile.email || undefined,
          name: profile.name || undefined,
          given_name: profile.given_name || undefined,
          family_name: profile.family_name || undefined,
          picture: profile.picture || undefined,
          gender: profile.gender || undefined,
          address: profile.address || undefined,
          birthday: birthdayValue,
        },
      })
      res.json(data)
    } catch {
      res.status(400).json({ message: 'Profile update attempt failed!' })
    }
  },
  /**
   * @swagger
   * /api/profile/picture:
   *   put:
   *     tags:
   *       - Profiles
   *     summary: Upload a user profile picture
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             $ref: '#/components/schemas/Profile'
   *     responses:
   *       200:
   *         description: Profile picture updated successfully
   *       404:
   *         description: Profile not found
   *       400:
   *         description: Profile picture update attempt failed!
   *       500:
   *         description: Internal server error
   */
  updateProfilePicture: async (req, res) => {
    try {
      // req.file là thông tin file sau khi đã được xử lý bởi multer
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      // Tạo URL cho file đã upload
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`

      // Trả về URL của file để frontend có thể cập nhật vào profile
      res.status(200).json({
        success: true,
        imageUrl: fileUrl,
      })
    } catch {
      res.status(400).json({ message: 'Profile picture update attempt failed!' })
    }
  },
  /**
   * @swagger
   * /api/profile:
   *   get:
   *     tags:
   *       - Profiles
   *     summary: Get user profiles
   *     responses:
   *       200:
   *         description: Successful operation
   */
  getAll: async (req, res) => {
    try {
      const users = await prisma.users.findMany({
        include: {
          profile: true,
        },
      })
      res.json(users)
    } catch {
      res.status(400).json({ message: 'Cannot find any profiles!' })
    }
  },

  /**
   * @swagger
   * /api/profile:
   *   delete:
   *     tags:
   *       - Profiles
   *     summary: delete a Profile by id
   *     responses:
   *       200:
   *         description: Successful operation
   *       404:
   *         description: Profile not found
   */
  delete: async (req, res) => {
    const { id } = req.params
    try {
      const response = await prisma.profile.delete({
        where: {
          id,
        },
      })
      res.json(response)
    } catch {
      res.status(400).json({ message: 'Profile delete attempt failed!' })
    }
  },
}
