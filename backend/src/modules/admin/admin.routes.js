import { Router } from 'express';
import {
  listUsersController,
  setUserPasswordController,
  updateUserActiveController,
  updateUserRolesController,
} from './admin.controller.js';
import { authenticate, requireRole } from '../../core/middleware/auth.middleware.js';
import { registerIdParams } from '../../core/http/params.js';

const adminRouter = registerIdParams(Router());

// Administración de cuentas: solo ADMINISTRADOR.
adminRouter.use(authenticate, requireRole('ADMINISTRADOR'));
adminRouter.get('/users', listUsersController);
adminRouter.put('/users/:userId/roles', updateUserRolesController);
adminRouter.patch('/users/:userId/active', updateUserActiveController);
adminRouter.put('/users/:userId/password', setUserPasswordController);

export default adminRouter;
