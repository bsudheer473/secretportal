import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { SecretsController } from '../controllers/secrets-controller';

export const reportsRouter = Router();

// All routes require authentication
reportsRouter.use(authenticate);

const controller = new SecretsController();

// GET /api/reports/access - Get access report (admin only)
reportsRouter.get('/access', (req, res, next) => controller.getAccessReport(req as AuthRequest, res, next));

// GET /api/reports/console-changes - Get AWS Console changes report (admin only)
reportsRouter.get('/console-changes', (req, res, next) => controller.getConsoleChangesReport(req as AuthRequest, res, next));
