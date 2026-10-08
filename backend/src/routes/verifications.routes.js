import { Router } from 'express';
import {
  listOrganizationsController,
  updateOrganizationVerificationController,
} from '../controllers/verifications.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const verificationsRouter = Router();

verificationsRouter.get('/organizations', authenticate, requireRole('USUARIO'), listOrganizationsController);
verificationsRouter.patch('/organizations/:organizationId', authenticate, requireRole('USUARIO'), updateOrganizationVerificationController);

export default verificationsRouter;
