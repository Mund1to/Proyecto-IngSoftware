import { Router } from 'express';
import {
  assignOfferToConvocatoriaController,
  createConvocatoriaController,
  deleteConvocatoriaController,
  getConvocatoriaByIdController,
  listConvocatoriaOffersController,
  listConvocatoriasController,
  unassignOfferFromConvocatoriaController,
  updateConvocatoriaController,
} from '../controllers/convocatorias.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { registerIdParams } from '../utils/params.js';

const convocatoriasRouter = registerIdParams(Router());

// Lectura pública de convocatorias.
convocatoriasRouter.get('/', listConvocatoriasController);
convocatoriasRouter.get('/:id', getConvocatoriaByIdController);
convocatoriasRouter.get('/:id/offers', listConvocatoriaOffersController);

// Gestión reservada a administradores y funcionarios públicos.
const canManage = [authenticate, requireRole('ADMINISTRADOR', 'FUNCIONARIO_PUBLICO')];
convocatoriasRouter.post('/', ...canManage, createConvocatoriaController);
convocatoriasRouter.patch('/:id', ...canManage, updateConvocatoriaController);
convocatoriasRouter.delete('/:id', ...canManage, deleteConvocatoriaController);
convocatoriasRouter.put('/:id/offers/:offerId', ...canManage, assignOfferToConvocatoriaController);
// Compatibilidad con la ruta publicada en la Fase 4.
convocatoriasRouter.patch('/:id/offers/:offerId', ...canManage, assignOfferToConvocatoriaController);
convocatoriasRouter.delete('/:id/offers/:offerId', ...canManage, unassignOfferFromConvocatoriaController);

export default convocatoriasRouter;
