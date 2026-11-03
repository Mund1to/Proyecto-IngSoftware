import { Router } from 'express';
import {
  createOfferController,
  deleteOfferController,
  deleteOfferPermanentlyController,
  restoreOfferController,
  getOfferByIdController,
  listMyOffersController,
  listOffersController,
  listRecommendedOffersController,
  updateOfferController,
} from './offers.controller.js';
import { authenticate, requireRole } from '../../core/middleware/auth.middleware.js';
import { registerIdParams } from '../../core/http/params.js';

const offersRouter = registerIdParams(Router());

offersRouter.get('/', listOffersController);
offersRouter.get('/recommended', authenticate, requireRole('USUARIO'), listRecommendedOffersController);
offersRouter.get('/mine', authenticate, requireRole('USUARIO'), listMyOffersController);
offersRouter.get('/:id', getOfferByIdController);
offersRouter.post('/', authenticate, requireRole('USUARIO'), createOfferController);
offersRouter.patch('/:id', authenticate, requireRole('USUARIO'), updateOfferController);
// Papelera: cancelar (a Canceladas), restaurar como borrador y borrar definitivamente.
offersRouter.delete('/:id', authenticate, requireRole('USUARIO'), deleteOfferController);
offersRouter.patch('/:id/restore', authenticate, requireRole('USUARIO'), restoreOfferController);
offersRouter.delete('/:id/permanent', authenticate, requireRole('USUARIO'), deleteOfferPermanentlyController);

export default offersRouter;
