import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default {
  getAll: async (req, res) => {
    try {
      const data = await prisma.$queryRaw`
            SELECT
              id,
              name,
              image,
              description,
              ST_AsGeoJSON(geom)::json AS geometry
            FROM "BusStop"
            ORDER BY name ASC
          `

      const formatted = data.map((row) => ({
        id: row.id,
        name: row.name,
        image: row.image,
        description: row.description,
        lng: row.geometry.coordinates[0],
        lat: row.geometry.coordinates[1],
      }))

      // console.log(formatted)

      res.json(formatted)
    } catch (error) {
      console.error('Lỗi truy vấn:', error)
      res.status(400).json({ message: 'Không thể lấy dữ liệu trạm xe buýt!' })
    }
  },

  getByName: async (req, res) => {
    const { name } = req.params
    try {
      const bus_stop = await prisma.$queryRaw`
        SELECT
          id,
          name,
          ST_AsGeoJSON(geom)::json AS geometry,
          image
        FROM "BusStop"
        WHERE name ILIKE ${'%' + name + '%'}
      `

      if (!bus_stop || bus_stop.length === 0) {
        return res.status(404).json({ message: 'No bus stop found!' })
      }

      const geojson = {
        type: 'FeatureCollection',
        features: bus_stop.map((bus_stop) => ({
          type: 'Feature',
          properties: {
            id: bus_stop.id,
            name: bus_stop.name,
            image: bus_stop.image,
          },
          geometry: bus_stop.geometry,
        })),
      }

      res.json(geojson)
    } catch (error) {
      console.error('Lỗi truy vấn:', error)
      res.status(400).json({ message: 'Cannot find restaurants!' })
    }
  },

  create: async (req, res) => {
    try {
      const { name, latitude, longitude, image, description } = req.body

      if (!name || !latitude || !longitude) {
        return res.status(400).json({ message: 'Name, latitude, and longitude are required!' })
      }

      const bus_stop = await prisma.$queryRaw`
        INSERT INTO "BusStop" (
          name,
          geom,
          image,
          description
        )
        VALUES (
          ${name},
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
          ${image},
          ${description}
        )
        RETURNING
          id,
          name,
          ST_AsGeoJSON(geom)::json AS geometry,
          image,
          description
      `

      const geojson = {
        type: 'Feature',
        properties: {
          id: bus_stop[0].id,
          name: bus_stop[0].name,
          image: bus_stop[0].image,
          description: bus_stop[0].description,
        },
        geometry: bus_stop[0].geometry,
      }

      res.status(201).json(geojson)
    } catch (error) {
      console.error('Lỗi:', error)
      res.status(400).json({ message: 'Bus stop create attempt failed!' })
    }
  },

  update: async (req, res) => {
    const { id } = req.params
    const { name, latitude, longitude, image, description } = req.body

    try {
      const bus_stop = await prisma.$queryRaw`
        UPDATE "BusStop"
        SET
          name = COALESCE(${name}, name),
          geom = COALESCE(${latitude && longitude ? `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)` : null}, geom),
          image = COALESCE(${image}, image),
          description = COALESCE(${description}, description)
        WHERE id = ${parseInt(id)}
        RETURNING
          id,
          name,
          ST_AsGeoJSON(geom)::json AS geometry,
          image,
          description
      `

      if (!bus_stop || bus_stop.length === 0) {
        return res.status(404).json({ message: 'Bus stop not found!' })
      }

      const geojson = {
        type: 'Feature',
        properties: {
          id: bus_stop[0].id,
          name: bus_stop[0].name,
          image: bus_stop[0].image,
          description: bus_stop[0].description,
        },
        geometry: bus_stop[0].geometry,
      }

      res.json(geojson)
    } catch (error) {
      console.error('Lỗi cập nhật nhà hàng:', error)
      res.status(400).json({ message: 'Restaurant update attempt failed!' })
    }
  },

  delete: async (req, res) => {
    const { id } = req.params
    try {
      const bus_stop = await prisma.$queryRaw`
        DELETE FROM "BusStop"
        WHERE id = ${parseInt(id)}
        RETURNING
          id,
          name,
          ST_AsGeoJSON(geom)::json AS geometry,
          image
      `

      if (!bus_stop || bus_stop.length === 0) {
        return res.status(404).json({ message: 'Bus stop not found!' })
      }

      const geojson = {
        type: 'Feature',
        properties: {
          id: bus_stop[0].id,
          name: bus_stop[0].name,
          image: bus_stop[0].image,
        },
        geometry: bus_stop[0].geometry,
      }

      res.json(geojson)
    } catch (error) {
      console.error('Lỗi:', error)
      res.status(400).json({ message: 'Bus stop delete attempt failed!' })
    }
  },
}
