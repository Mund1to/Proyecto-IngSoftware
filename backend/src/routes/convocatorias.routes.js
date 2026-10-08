import { Router } from 'express';
import {
  assignOfferToConvocatoriaController,
  createConvocatoriaController,
  deleteConvocatoriaController,
  getConvocatoriaByIdController,
  listConvocatoriasController,
  updateConvocatoriaController,
} from '../controllers/convocatorias.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const convocatoriasRouter = Router();

// Lectura pública de convocatorias.
convocatoriasRouter.get('/', listConvocatoriasController);
convocatoriasRouter.get('/:id', getConvocatoriaByIdController);

// Gestión reservada a administradores y funcionarios públicos.
const canManage = [authenticate, requireRole('ADMINISTRADOR', 'FUNCIONARIO_PUBLICO')];
convocatoriasRouter.post('/', ...canManage, createConvocatoriaController);
convocatoriasRouter.patch('/:id', ...canManage, updateConvocatoriaController);
convocatoriasRouter.delete('/:id', ...canManage, deleteConvocatoriaController);
convocatoriasRouter.patch('/:id/offers/:offerId', ...canManage, assignOfferToConvocatoriaController);

export default convocatoriasRouter;
