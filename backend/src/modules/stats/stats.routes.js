import { Router } from 'express';
import { getEmploymentStatsController } from './stats.controller.js';
import { authenticate, requireRole } from '../../core/middleware/auth.middleware.js';

const statsRouter = Router();

// #21 HU-17: cifras agregadas para funcionarios y administradores.
statsRouter.get('/employment', authenticate, requireRole('ADMINISTRADOR', 'FUNCIONARIO_PUBLICO'), getEmploymentStatsController);

export default statsRouter;
