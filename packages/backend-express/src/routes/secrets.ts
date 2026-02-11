import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { SecretsController } from '../controllers/secrets-controller';

export const secretsRouter = Router();

// All routes require authentication
secretsRouter.use(authenticate);

const controller = new SecretsController();

// GET /api/secrets - List secrets
secretsRouter.get('/', (req, res, next) => controller.listSecrets(req as AuthRequest, res, next));

// GET /api/secrets/search - Search secrets
secretsRouter.get('/search', (req, res, next) => controller.searchSecrets(req as AuthRequest, res, next));

// GET /api/secrets/applications - Get distinct applications
secretsRouter.get('/applications', (req, res, next) => controller.getApplications(req as AuthRequest, res, next));

// GET /api/secrets/environments - Get distinct environments
secretsRouter.get('/environments', (req, res, next) => controller.getEnvironments(req as AuthRequest, res, next));

// POST /api/secrets - Create secret
secretsRouter.post('/', (req, res, next) => controller.createSecret(req as AuthRequest, res, next));

// GET /api/secrets/:id - Get secret metadata
secretsRouter.get('/:id', (req, res, next) => controller.getSecret(req as AuthRequest, res, next));

// PUT /api/secrets/:id - Update secret
secretsRouter.put('/:id', (req, res, next) => controller.updateSecret(req as AuthRequest, res, next));

// GET /api/secrets/:id/console-url - Get AWS console URL
secretsRouter.get('/:id/console-url', (req, res, next) => controller.getConsoleUrl(req as AuthRequest, res, next));

// PUT /api/secrets/:id/rotation - Update rotation period
secretsRouter.put('/:id/rotation', (req, res, next) => controller.updateRotation(req as AuthRequest, res, next));

// GET /api/secrets/:id/audit - Get audit logs for a secret
secretsRouter.get('/:id/audit', (req, res, next) => controller.getAuditLogs(req as AuthRequest, res, next));
