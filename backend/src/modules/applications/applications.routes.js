import { Router } from 'express';
import {
  addApplicationNoteController,
  applyToOfferController,
  getApplicationCvController,
  listApplicationsForOfferController,
  listMyApplicationsController,
  rateApplicationController,
  replaceApplicationCvController,
  updateApplicationStatusController,
  withdrawApplicationController,
} from './applications.controller.js';
import { authenticate, requireRole } from '../../core/middleware/auth.middleware.js';
import { rawFileBody } from '../../core/http/files.js';
import { registerIdParams } from '../../core/http/params.js';

const applicationsRouter = registerIdParams(Router());

applicationsRouter.get('/me', authenticate, requireRole('USUARIO'), listMyApplicationsController);
applicationsRouter.get('/offers/:offerId', authenticate, requireRole('USUARIO'), listApplicationsForOfferController);
applicationsRouter.post('/offers/:offerId', authenticate, requireRole('USUARIO'), applyToOfferController);
// Proceso de selección (organización dueña de la oferta): etapa con mensaje y
// entrevista, notas privadas y calificación interna.
applicationsRouter.patch('/:id/status', authenticate, requireRole('USUARIO'), updateApplicationStatusController);
applicationsRouter.post('/:id/notes', authenticate, requireRole('USUARIO'), addApplicationNoteController);
applicationsRouter.patch('/:id/rating', authenticate, requireRole('USUARIO'), rateApplicationController);
// Hoja de vida enviada con la postulación: la empresa o el candidato la consultan;
// el candidato puede reemplazarla (cuerpo binario, nombre en X-File-Name) mientras siga ENVIADA.
applicationsRouter.get('/:id/cv', authenticate, requireRole('USUARIO'), getApplicationCvController);
applicationsRouter.put('/:id/cv', authenticate, requireRole('USUARIO'), rawFileBody('5mb'), replaceApplicationCvController);
applicationsRouter.patch('/:id/withdraw', authenticate, requireRole('USUARIO'), withdrawApplicationController);

export default applicationsRouter;
