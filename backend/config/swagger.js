const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart Route Management and Scheduling System (SRMSS) API',
      version: '1.0.0',
      description: 'API Documentation for the SRMSS public transit depot scheduling, fuel management, maintenance logs, and system audit logs.',
    },
    servers: [
      {
        url: 'http://localhost:5001',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Input your login JWT token to authorize API endpoints.',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './backend/routes/*.js'], // cover different working directory structures
};

const specs = swaggerJsdoc(options);

module.exports = specs;
