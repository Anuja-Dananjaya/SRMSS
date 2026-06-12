const swaggerJsdoc = require('swagger-jsdoc');

// Swagger definition (OpenAPI 3.0)
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'SRMSS API Documentation',
    version: '1.0.0',
    description: 'Smart Route Management and Scheduling System (SRMSS) API',
  },
  servers: [
    {
      url: `http://localhost:${process.env.SERVER_PORT || 5000}`,
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

// Options for swagger-jsdoc - it will look for JSDoc comments in the specified files
const options = {
  definition: swaggerDefinition,
  // Paths to files containing OpenAPI definitions
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './server.js',
  ],
};

// Initialize swagger-jsdoc -> returns validated swagger spec in json format
const swaggerSpecs = swaggerJsdoc(options);

module.exports = swaggerSpecs;
