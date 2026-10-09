import express, { Router } from 'express';
import {
  changePasswordController,
  getCurrentUserController,
  updateCurrentUserController,
  updateExternalProfileController,
  updateOrganizationProfileController,
  updateStudentProfileController,
} from '../controllers/profile.controller.js';
import {
  deleteProfileFileController,
  getProfileDetailsController,
  getProfileFileController,
  replaceEducationController,
  replaceExperienceController,
  replaceSkillsController,
  uploadProfileFileController,
} from '../controllers/profileDetails.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const profileRouter = Router();

profileRouter.get('/me', authenticate, getCurrentUserController);
profileRouter.put('/me', authenticate, updateCurrentUserController);
profileRouter.put('/password', authenticate, changePasswordController);
profileRouter.put('/student', authenticate, updateStudentProfileController);
profileRouter.put('/organization', authenticate, updateOrganizationProfileController);
profileRouter.put('/external', authenticate, updateExternalProfileController);

// Fase 6: hoja de vida estructurada y archivos del perfil.
profileRouter.get('/details', authenticate, getProfileDetailsController);
profileRouter.put('/education', authenticate, replaceEducationController);
profileRouter.put('/experience', authenticate, replaceExperienceController);
profileRouter.put('/skills', authenticate, replaceSkillsController);

// El archivo llega como cuerpo binario; el nombre viaja en la cabecera X-File-Name.
const rawFile = express.raw({ type: () => true, limit: '5mb' });
profileRouter.get('/files/:tipo', authenticate, getProfileFileController);
profileRouter.put('/files/:tipo', authenticate, rawFile, uploadProfileFileController);
profileRouter.delete('/files/:tipo', authenticate, deleteProfileFileController);

export default profileRouter;
