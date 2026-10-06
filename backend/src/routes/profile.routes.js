import { Router } from 'express';
import { getCurrentUserController } from '../controllers/profile.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const profileRouter = Router();

profileRouter.get('/me', authenticate, getCurrentUserController);

export default profileRouter;
