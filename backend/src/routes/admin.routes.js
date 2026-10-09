import { Router } from 'express';
import {
  listUsersController,
  updateUserActiveController,
  updateUserRolesController,
} from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { registerIdParams } from '../utils/params.js';

const adminRouter = registerIdParams(Router());

// Administración de cuentas: solo ADMINISTRADOR.
adminRouter.use(authenticate, requireRole('ADMINISTRADOR'));
adminRouter.get('/users', listUsersController);
adminRouter.put('/users/:userId/roles', updateUserRolesController);
adminRouter.patch('/users/:userId/active', updateUserActiveController);

export default adminRouter;
