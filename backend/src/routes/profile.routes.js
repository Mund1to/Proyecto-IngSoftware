import { Router } from 'express';
import {
  getCurrentUserController,
  updateCurrentUserController,
  updateOrganizationProfileController,
  updateStudentProfileController,
} from '../controllers/profile.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const profileRouter = Router();

profileRouter.get('/me', authenticate, getCurrentUserController);
profileRouter.put('/me', authenticate, updateCurrentUserController);
profileRouter.put('/student', authenticate, updateStudentProfileController);
profileRouter.put('/organization', authenticate, updateOrganizationProfileController);

export default profileRouter;
