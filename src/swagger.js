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
        url: 'http://localhost:3000/api/v1',
        description: 'Local (v1)'
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