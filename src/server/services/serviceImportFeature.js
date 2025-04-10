import 'dotenv/config'
import fetch from 'node-fetch'
const baseUrl = process.env.GEO_SERVER_URL
const username = process.env.GEO_SERVER_ADMIN
const password = process.env.GEO_SERVER_PASSWORD
const encodedCredentials = Buffer.from(`${username}:${password}`).toString('base64')
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default {
  updateFeature: async (req, res) => {
    const { name, workspace } = req.params
    console.log('name', name)
    const mapLayers = await prisma.mapLayer.findMany({
      select: {
        url: true,
        id: true,
      },
    })
    for (const ml of mapLayers) {
      const url = ml.url
      fetch(
        `${baseUrl}/${workspace}/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=${url}&maxFeatures=52000&outputFormat=application%2Fjson`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${encodedCredentials}`,
          },
        },
      )
        .then((response) => response.json())
        .then(async (response) => {
          await prisma.feature.createMany({
            data: response.features.map((item) => ({
              name: item.id || null,
              properties: JSON.stringify(item.properties) || null,
              layerId: ml.id,
            })),
            skipDuplicates: true,
          })
        })
    }
    res.status(200).json({ message: 'Done!' })
  },
}
