import { Router } from 'express';
import {
  decideRequestController,
  getDocumentController,
  listOrganizationsController,
  listRequestsController,
  requestsSummaryController,
  updateOrganizationVerificationController,
} from './verifications.controller.js';
import {
  deleteDocumentController,
  getMyDocumentController,
  getMyVerificationController,
  submitRequestController,
  uploadDocumentController,
  withdrawRequestController,
} from './organizationVerification.controller.js';
import { authenticate, requireRole } from '../../core/middleware/auth.middleware.js';
import { rawFileBody } from '../../core/http/files.js';
import { registerIdParams } from '../../core/http/params.js';

const verificationsRouter = registerIdParams(Router());

// Fase 7: la empresa gestiona sus documentos y su solicitud. El servicio
// comprueba que la cuenta tenga un perfil de organización.
const signedIn = [authenticate, requireRole('USUARIO')];
verificationsRouter.get('/me', ...signedIn, getMyVerificationController);
verificationsRouter.post('/me/documents', ...signedIn, rawFileBody('5mb'), uploadDocumentController);
verificationsRouter.get('/me/documents/:documentId', ...signedIn, getMyDocumentController);
verificationsRouter.delete('/me/documents/:documentId', ...signedIn, deleteDocumentController);
verificationsRouter.post('/me/request', ...signedIn, submitRequestController);
verificationsRouter.delete('/me/request', ...signedIn, withdrawRequestController);

// Solo administradores y funcionarios públicos revisan verificaciones.
const canReview = [authenticate, requireRole('ADMINISTRADOR', 'FUNCIONARIO_PUBLICO')];
verificationsRouter.get('/organizations', ...canReview, listOrganizationsController);
verificationsRouter.patch('/organizations/:organizationId', ...canReview, updateOrganizationVerificationController);
verificationsRouter.get('/requests', ...canReview, listRequestsController);
verificationsRouter.get('/requests/summary', ...canReview, requestsSummaryController);
verificationsRouter.patch('/requests/:requestId', ...canReview, decideRequestController);
verificationsRouter.get('/documents/:documentId', ...canReview, getDocumentController);

export default verificationsRouter;
