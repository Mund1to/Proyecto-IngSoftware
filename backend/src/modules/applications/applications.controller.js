// Capa HTTP de postulaciones: lee la petición, llama al servicio y arma la respuesta.
import { asyncHandler } from '../../core/http/errors.js';
import { sendStoredFile } from '../profile/profileDetails.controller.js';
import * as applicationsService from './applications.service.js';

export const listMyApplicationsController = asyncHandler(async function listMyApplicationsController(request, response) {
  const applications = await applicationsService.listMyApplications(request.auth.sub);
  return response.json({ ok: true, applications });
}, 'No se pudo listar tus postulaciones.');

export const listApplicationsForOfferController = asyncHandler(async function listApplicationsForOfferController(request, response) {
  const applications = await applicationsService.listApplicationsForOffer(request.auth.sub, request.params.offerId);
  return response.json({ ok: true, applications });
}, 'No se pudo obtener la información de postulaciones.');

export const applyToOfferController = asyncHandler(async function applyToOfferController(request, response) {
  const application = await applicationsService.applyToOffer(request.auth.sub, request.params.offerId, request.body ?? {});
  return response.status(201).json({ ok: true, application });
}, 'No se pudo registrar la postulación.');

export const updateApplicationStatusController = asyncHandler(async function updateApplicationStatusController(request, response) {
  const application = await applicationsService.updateApplicationStatus(request.auth.sub, request.params.id, request.body ?? {});
  return response.json({ ok: true, application });
}, 'No se pudo actualizar la postulación.');

export const withdrawApplicationController = asyncHandler(async function withdrawApplicationController(request, response) {
  const application = await applicationsService.withdrawApplication(request.auth.sub, request.params.id);
  return response.json({ ok: true, application });
}, 'No se pudo retirar la postulación.');

export const getApplicationCvController = asyncHandler(async function getApplicationCvController(request, response) {
  const file = await applicationsService.getApplicationCv(request.auth.sub, request.params.id);
  return sendStoredFile(response, file);
}, 'No se pudo obtener la hoja de vida.');
