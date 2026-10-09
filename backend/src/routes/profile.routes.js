import { Router } from 'express';
import {
  changePasswordController,
  getCurrentUserController,
  updateCurrentUserController,
  updateExternalProfileController,
  updateOrganizationProfileController,
  updateStudentProfileController,
} from '../controllers/profile.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const profileRouter = Router();

profileRouter.get('/me', authenticate, getCurrentUserController);
profileRouter.put('/me', authenticate, updateCurrentUserController);
profileRouter.put('/password', authenticate, changePasswordController);
profileRouter.put('/student', authenticate, updateStudentProfileController);
profileRouter.put('/organization', authenticate, updateOrganizationProfileController);
profileRouter.put('/external', authenticate, updateExternalProfileController);

export default profileRouter;
