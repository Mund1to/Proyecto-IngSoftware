import { Router } from 'express';
import {
  listOrganizationsController,
  updateOrganizationVerificationController,
} from '../controllers/verifications.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { registerIdParams } from '../utils/params.js';

const verificationsRouter = registerIdParams(Router());

// Solo administradores y funcionarios públicos revisan verificaciones.
const canReview = [authenticate, requireRole('ADMINISTRADOR', 'FUNCIONARIO_PUBLICO')];
verificationsRouter.get('/organizations', ...canReview, listOrganizationsController);
verificationsRouter.patch('/organizations/:organizationId', ...canReview, updateOrganizationVerificationController);

export default verificationsRouter;
