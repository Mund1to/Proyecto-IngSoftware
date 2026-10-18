// #18 HU-14: convocatorias públicas (Fase 4).
// Lectura abierta a cualquier usuario; creación y edición solo para
// ADMINISTRADOR o FUNCIONARIO_PUBLICO (se restringe en la ruta).
import { badRequest, notFound } from '../../core/http/errors.js';
import { getBodyValue, hasBodyValue, normalizeString, toNullableString } from '../../core/http/payload.js';
import * as convocatoriasRepository from './convocatorias.repository.js';

const NOT_FOUND_MESSAGE = 'Convocatoria no encontrada.';
const DATE_ORDER_MESSAGE = 'La fecha de fin no puede ser anterior a la de inicio.';

function isValidDate(value) {
  return value === null || Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());
}

function parseConvocatoria(payload) {
  return {
    titulo: normalizeString(getBodyValue(payload, ['titulo', 'title'])),
    descripcion: normalizeString(getBodyValue(payload, ['descripcion', 'description'])),
    fechaInicio: toNullableString(getBodyValue(payload, ['fechaInicio', 'fecha_inicio'])),
    fechaFin: toNullableString(getBodyValue(payload, ['fechaFin', 'fecha_fin'])),
  };
}

function assertValidDates({ fechaInicio, fechaFin }) {
  if (!isValidDate(fechaInicio) || !isValidDate(fechaFin)) {
    throw badRequest('Las fechas de la convocatoria no son válidas.');
  }
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    throw badRequest(DATE_ORDER_MESSAGE);
  }
}

async function assertExists(id) {
  if (!(await convocatoriasRepository.exists(id))) throw notFound(NOT_FOUND_MESSAGE);
}

export function listConvocatorias() {
  return convocatoriasRepository.list();
}

export async function getConvocatoria(id) {
  const convocatoria = await convocatoriasRepository.findById(id);
  if (!convocatoria) throw notFound(NOT_FOUND_MESSAGE);
  return convocatoria;
}

export async function createConvocatoria(payload = {}) {
  const values = parseConvocatoria(payload);
  if (!values.titulo) throw badRequest('La convocatoria requiere un título.');
  assertValidDates(values);
  return convocatoriasRepository.insert(values);
}

export async function updateConvocatoria(id, payload = {}) {
  const values = parseConvocatoria(payload);
  assertValidDates(values);

  let convocatoria;
  try {
    convocatoria = await convocatoriasRepository.update(id, {
      ...values,
      setFechaInicio: hasBodyValue(payload, ['fechaInicio', 'fecha_inicio']),
      setFechaFin: hasBodyValue(payload, ['fechaFin', 'fecha_fin']),
    });
  } catch (error) {
    // La fecha enviada choca con la que ya estaba guardada (restricción de la tabla).
    if (error?.code === '23514') throw badRequest(DATE_ORDER_MESSAGE);
    throw error;
  }

  if (!convocatoria) throw notFound(NOT_FOUND_MESSAGE);
  return convocatoria;
}

export async function deleteConvocatoria(id) {
  const deleted = await convocatoriasRepository.remove(id);
  if (!deleted) throw notFound(NOT_FOUND_MESSAGE);
  return Number(deleted.id);
}

export async function listConvocatoriaOffers(id) {
  await assertExists(id);
  return convocatoriasRepository.listPublishedOffers(id);
}

// Asocia la oferta offerId a la convocatoria id.
export async function assignOffer(id, offerId) {
  await assertExists(id);
  const offer = await convocatoriasRepository.assignOffer(id, offerId);
  if (!offer) throw notFound('Oferta no encontrada.');
  return offer;
}

// Quita la oferta offerId de la convocatoria id.
export async function unassignOffer(id, offerId) {
  const offer = await convocatoriasRepository.unassignOffer(id, offerId);
  if (!offer) throw notFound('La oferta no pertenece a esta convocatoria.');
  return offer;
}
