// Capa HTTP de ofertas: lee la petición, llama al servicio y arma la respuesta.
import { asyncHandler } from '../../core/http/errors.js';
import * as offersService from './offers.service.js';

export const listRecommendedOffersController = asyncHandler(async function listRecommendedOffersController(request, response) {
  const offers = await offersService.listRecommendedOffers(request.auth.sub);
  return response.json({ ok: true, offers });
}, 'No se pudieron generar las recomendaciones.');

export const listOffersController = asyncHandler(async function listOffersController(_request, response) {
  const offers = await offersService.listPublishedOffers();
  return response.json({ ok: true, offers });
}, 'No se pudo listar las ofertas.');

export const listMyOffersController = asyncHandler(async function listMyOffersController(request, response) {
  const offers = await offersService.listOrganizationOffers(request.auth.sub);
  return response.json({ ok: true, offers });
}, 'No se pudo listar tus ofertas.');

export const getOfferByIdController = asyncHandler(async function getOfferByIdController(request, response) {
  const offer = await offersService.getPublishedOffer(request.params.id);
  return response.json({ ok: true, offer });
}, 'No se pudo obtener la oferta.');

export const createOfferController = asyncHandler(async function createOfferController(request, response) {
  const offer = await offersService.createOffer(request.auth.sub, request.body);
  return response.status(201).json({ ok: true, offer });
}, 'No se pudo crear la oferta.');

export const updateOfferController = asyncHandler(async function updateOfferController(request, response) {
  const offer = await offersService.updateOffer(request.auth.sub, request.params.id, request.body);
  return response.json({ ok: true, offer });
}, 'No se pudo actualizar la oferta.');

// DELETE /offers/:id manda la oferta a la papelera (Canceladas); no la borra.
export const deleteOfferController = asyncHandler(async function deleteOfferController(request, response) {
  const { offer, notified } = await offersService.cancelOffer(request.auth.sub, request.params.id, request.body ?? {});
  return response.json({ ok: true, deletedOfferId: Number(offer.id), offer, notifiedApplications: notified });
}, 'No se pudo cancelar la oferta.');

export const restoreOfferController = asyncHandler(async function restoreOfferController(request, response) {
  const offer = await offersService.restoreOffer(request.auth.sub, request.params.id);
  return response.json({ ok: true, offer });
}, 'No se pudo restaurar la oferta.');

export const deleteOfferPermanentlyController = asyncHandler(async function deleteOfferPermanentlyController(request, response) {
  const deletedOfferId = await offersService.deleteOfferPermanently(request.auth.sub, request.params.id);
  return response.json({ ok: true, deletedOfferId });
}, 'No se pudo eliminar la oferta.');
