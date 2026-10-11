// Capa HTTP de la hoja de vida estructurada y los archivos del perfil.
import { asyncHandler } from '../../core/http/errors.js';
import { sendStoredFile } from '../../core/http/files.js';
import { getBodyValue } from '../../core/http/payload.js';
import * as detailsService from './profileDetails.service.js';

export const getProfileDetailsController = asyncHandler(async function getProfileDetailsController(request, response) {
  const details = await detailsService.getDetails(request.auth.sub);
  return response.json({ ok: true, details });
}, 'No se pudo cargar el detalle del perfil.');

function makeReplaceController(collection) {
  return asyncHandler(async function replaceCollectionController(request, response) {
    const items = getBodyValue(request.body ?? {}, ['items']);
    const details = await detailsService.replaceCollection(request.auth.sub, collection, items);
    return response.json({ ok: true, details });
  }, 'No se pudieron guardar los cambios.');
}

export const replaceEducationController = makeReplaceController(detailsService.COLLECTIONS.education);
export const replaceExperienceController = makeReplaceController(detailsService.COLLECTIONS.experience);
export const replaceSkillsController = makeReplaceController(detailsService.COLLECTIONS.skills);

export const uploadProfileFileController = asyncHandler(async function uploadProfileFileController(request, response) {
  const file = await detailsService.uploadFile(request.auth.sub, request.params.tipo, {
    buffer: Buffer.isBuffer(request.body) ? request.body : null,
    contentType: request.get('content-type'),
    rawName: request.get('x-file-name'),
  });
  return response.status(201).json({ ok: true, file });
}, 'No se pudo guardar el archivo.');

export const getProfileFileController = asyncHandler(async function getProfileFileController(request, response) {
  const file = await detailsService.getFile(request.auth.sub, request.params.tipo);
  return sendStoredFile(response, file);
}, 'No se pudo obtener el archivo.');

export const deleteProfileFileController = asyncHandler(async function deleteProfileFileController(request, response) {
  await detailsService.deleteFile(request.auth.sub, request.params.tipo);
  return response.json({ ok: true });
}, 'No se pudo eliminar el archivo.');
