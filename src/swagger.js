const swaggerJsdoc = require('swagger-jsdoc')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Light Solution — API Servicio Técnico',
      version: '1.0.0',
      description: 'API REST para gestión de servicio técnico de equipos de escenografía',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? 'https://servicio-tecnico-backend-2o5r.onrender.com/api'
          : 'http://localhost:3000/api',
        description: process.env.NODE_ENV === 'production' ? 'Producción' : 'Local'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.js']
}

module.exports = swaggerJsdoc(options)