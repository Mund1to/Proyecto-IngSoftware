import { Router } from 'express';
import {
  applyToOfferController,
  listApplicationsForOfferController,
  listMyApplicationsController,
  updateApplicationStatusController,
} from '../controllers/applications.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const applicationsRouter = Router();

applicationsRouter.get('/me', authenticate, requireRole('USUARIO'), listMyApplicationsController);
applicationsRouter.get('/offers/:offerId', authenticate, requireRole('USUARIO'), listApplicationsForOfferController);
applicationsRouter.post('/offers/:offerId', authenticate, requireRole('USUARIO'), applyToOfferController);
applicationsRouter.patch('/:id/status', authenticate, requireRole('USUARIO'), updateApplicationStatusController);

export default applicationsRouter;
