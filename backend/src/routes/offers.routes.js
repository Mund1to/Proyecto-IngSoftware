import { Router } from 'express';
import {
  createOfferController,
  deleteOfferController,
  getOfferByIdController,
  listMyOffersController,
  listOffersController,
  listRecommendedOffersController,
  updateOfferController,
} from '../controllers/offers.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const offersRouter = Router();

offersRouter.get('/', listOffersController);
offersRouter.get('/recommended', authenticate, requireRole('USUARIO'), listRecommendedOffersController);
offersRouter.get('/mine', authenticate, requireRole('USUARIO'), listMyOffersController);
offersRouter.get('/:id', getOfferByIdController);
offersRouter.post('/', authenticate, requireRole('USUARIO'), createOfferController);
offersRouter.patch('/:id', authenticate, requireRole('USUARIO'), updateOfferController);
offersRouter.delete('/:id', authenticate, requireRole('USUARIO'), deleteOfferController);

export default offersRouter;
