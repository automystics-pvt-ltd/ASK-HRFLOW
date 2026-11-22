import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ASK HRFlow API',
      version: '1.0.0',
      description: 'HR platform API with JWT cookie auth and RBAC',
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'hrflow_token' },
      },
    },
    security: [{ cookieAuth: [] }],
  },
  apis: ['./server/src/routes/*.ts', './server/src/index.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

export function mountSwagger(app: Express) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
}