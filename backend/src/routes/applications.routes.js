import { Router } from 'express';
import {
  applyToOfferController,
  getApplicationCvController,
  listApplicationsForOfferController,
  listMyApplicationsController,
  updateApplicationStatusController,
  withdrawApplicationController,
} from '../controllers/applications.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { registerIdParams } from '../utils/params.js';

const applicationsRouter = registerIdParams(Router());

applicationsRouter.get('/me', authenticate, requireRole('USUARIO'), listMyApplicationsController);
applicationsRouter.get('/offers/:offerId', authenticate, requireRole('USUARIO'), listApplicationsForOfferController);
applicationsRouter.post('/offers/:offerId', authenticate, requireRole('USUARIO'), applyToOfferController);
applicationsRouter.patch('/:id/status', authenticate, requireRole('USUARIO'), updateApplicationStatusController);
applicationsRouter.get('/:id/cv', authenticate, requireRole('USUARIO'), getApplicationCvController);
applicationsRouter.patch('/:id/withdraw', authenticate, requireRole('USUARIO'), withdrawApplicationController);

export default applicationsRouter;
