// Capa HTTP de convocatorias.
import { asyncHandler } from '../../core/http/errors.js';
import * as convocatoriasService from './convocatorias.service.js';

export const listConvocatoriasController = asyncHandler(async function listConvocatoriasController(_request, response) {
  const convocatorias = await convocatoriasService.listConvocatorias();
  return response.json({ ok: true, convocatorias });
}, 'No se pudieron listar las convocatorias.');

export const getConvocatoriaByIdController = asyncHandler(async function getConvocatoriaByIdController(request, response) {
  const convocatoria = await convocatoriasService.getConvocatoria(request.params.id);
  return response.json({ ok: true, convocatoria });
}, 'No se pudo obtener la convocatoria.');

export const createConvocatoriaController = asyncHandler(async function createConvocatoriaController(request, response) {
  const convocatoria = await convocatoriasService.createConvocatoria(request.body ?? {});
  return response.status(201).json({ ok: true, convocatoria });
}, 'No se pudo crear la convocatoria.');

export const updateConvocatoriaController = asyncHandler(async function updateConvocatoriaController(request, response) {
  const convocatoria = await convocatoriasService.updateConvocatoria(request.params.id, request.body ?? {});
  return response.json({ ok: true, convocatoria });
}, 'No se pudo actualizar la convocatoria.');

export const deleteConvocatoriaController = asyncHandler(async function deleteConvocatoriaController(request, response) {
  const deletedConvocatoriaId = await convocatoriasService.deleteConvocatoria(request.params.id);
  return response.json({ ok: true, deletedConvocatoriaId });
}, 'No se pudo eliminar la convocatoria.');

export const listConvocatoriaOffersController = asyncHandler(async function listConvocatoriaOffersController(request, response) {
  const offers = await convocatoriasService.listConvocatoriaOffers(request.params.id);
  return response.json({ ok: true, offers });
}, 'No se pudieron listar las ofertas de la convocatoria.');

export const assignOfferToConvocatoriaController = asyncHandler(async function assignOfferToConvocatoriaController(request, response) {
  const offer = await convocatoriasService.assignOffer(request.params.id, request.params.offerId);
  return response.json({ ok: true, offer });
}, 'No se pudo asociar la oferta a la convocatoria.');

export const unassignOfferFromConvocatoriaController = asyncHandler(async function unassignOfferFromConvocatoriaController(request, response) {
  const offer = await convocatoriasService.unassignOffer(request.params.id, request.params.offerId);
  return response.json({ ok: true, offer });
}, 'No se pudo quitar la oferta de la convocatoria.');
