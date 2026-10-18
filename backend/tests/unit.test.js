import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maxScoreOffer, offerAffinity, scoreOffer } from '../src/modules/offers/offers.scoring.js';
import { cleanFileName, hasValidSignature, normalizeMime } from '../src/core/http/files.js';
import { createRateLimiter } from '../src/core/middleware/rateLimit.middleware.js';
import { normalizeModality } from '../src/modules/offers/offers.domain.js';
import {
  getBodyValue,
  hasBodyValue,
  normalizeNumber,
  normalizeStringList,
  toNullableString,
} from '../src/core/http/payload.js';

describe('utilidades de payload', () => {
  it('getBodyValue toma la primera clave presente y no nula', () => {
    assert.equal(getBodyValue({ title: 'B', titulo: 'A' }, ['titulo', 'title']), 'A');
    assert.equal(getBodyValue({ titulo: null, title: 'B' }, ['titulo', 'title']), 'B');
    assert.equal(getBodyValue({}, ['titulo']), undefined);
  });

  it('hasBodyValue detecta claves enviadas aunque sean null', () => {
    assert.equal(hasBodyValue({ telefono: null }, ['telefono']), true);
    assert.equal(hasBodyValue({}, ['telefono']), false);
  });

  it('toNullableString recorta y convierte vacíos en null', () => {
    assert.equal(toNullableString('  hola '), 'hola');
    assert.equal(toNullableString('   '), null);
    assert.equal(toNullableString(undefined), null);
  });

  it('normalizeNumber acepta números y descarta texto', () => {
    assert.equal(normalizeNumber('1200'), 1200);
    assert.equal(normalizeNumber(''), null);
    assert.equal(normalizeNumber('abc'), null);
  });

  it('normalizeStringList acepta arreglos o texto separado por comas o líneas', () => {
    assert.deepEqual(normalizeStringList([' a ', '', 'b']), ['a', 'b']);
    assert.deepEqual(normalizeStringList('a, b\nc'), ['a', 'b', 'c']);
    assert.deepEqual(normalizeStringList(42), []);
  });
});

describe('normalizeModality', () => {
  it('reconoce variantes y texto mal codificado', () => {
    assert.equal(normalizeModality('Híbrida'), 'Híbrida');
    assert.equal(normalizeModality('hibrido'), 'Híbrida');
    assert.equal(normalizeModality('H�brida'), 'Híbrida');
    assert.equal(normalizeModality('PRESENCIAL'), 'Presencial');
    assert.equal(normalizeModality('Remoto'), 'Remota');
    assert.equal(normalizeModality('virtual'), 'Remota');
  });

  it('devuelve null si está vacía y undefined si es desconocida', () => {
    assert.equal(normalizeModality(''), null);
    assert.equal(normalizeModality(null), null);
    assert.equal(normalizeModality('nocturna'), undefined);
  });
});

describe('scoreOffer', () => {
  const offer = { area: 'Tecnología', ubicacion: 'Bogotá', tipo: 'PRACTICA', requisitos: ['JavaScript', 'SQL'] };

  it('premia coincidencia de área, ciudad y tipo para estudiantes', () => {
    const student = { tipo: 'ESTUDIANTE', programa_academico: 'Tecnología', ubicacion: 'Bogotá' };
    assert.equal(scoreOffer(offer, student), 40 + 25 + 20);
  });

  it('suma requisitos mencionados en el resumen del candidato externo', () => {
    const external = { tipo: 'CANDIDATO_EXTERNO', resumen: 'javascript, sql', ubicacion: 'Cali' };
    const employment = { ...offer, tipo: 'EMPLEO' };
    assert.equal(scoreOffer(employment, external), 15 * 2 + 20);
  });

  it('no falla con perfiles vacíos', () => {
    assert.equal(scoreOffer({}, {}), 0);
  });
});

describe('offerAffinity', () => {
  const offer = { area: 'Tecnología', ubicacion: 'Bogotá', tipo: 'PRACTICA', requisitos: ['JavaScript', 'SQL'] };

  it('normaliza el puntaje contra el máximo posible (0 a 100)', () => {
    // Estudiante: área 40 + 2 requisitos 30 + práctica 20 = 90 posibles; la ciudad no cuenta.
    assert.equal(maxScoreOffer(offer, { tipo: 'ESTUDIANTE' }), 90);
    const full = { tipo: 'ESTUDIANTE', programa_academico: 'Tecnología', habilidades: ['JavaScript', 'SQL'] };
    assert.equal(offerAffinity(offer, full), 100);
    const partial = { tipo: 'ESTUDIANTE', programa_academico: 'Tecnología' };
    assert.equal(offerAffinity(offer, partial), Math.round((60 / 90) * 100));
  });

  it('cuenta la ciudad para el candidato externo y nunca pasa de 100', () => {
    const employment = { ...offer, tipo: 'EMPLEO' };
    const external = { tipo: 'CANDIDATO_EXTERNO', resumen: 'Tecnología, javascript, sql', ubicacion: 'Bogotá' };
    assert.equal(maxScoreOffer(employment, external), 40 + 25 + 30 + 20);
    const affinity = offerAffinity(employment, external);
    assert.ok(affinity > 0 && affinity <= 100);
  });

  it('con el perfil vacío solo cuenta el tipo de oferta, y una oferta sin datos da 0', () => {
    assert.equal(offerAffinity(offer, { tipo: 'ESTUDIANTE' }), Math.round((20 / 90) * 100));
    assert.equal(offerAffinity({}, {}), 0);
  });
});

describe('createRateLimiter', () => {
  it('bloquea al superar el máximo y se puede reiniciar', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 2, keyGenerator: () => 'k', message: 'alto' });
    const calls = [];
    const response = {
      status(code) { this.code = code; return this; },
      json(body) { calls.push({ code: this.code, body }); return this; },
      set() { return this; },
    };
    let passed = 0;
    const next = () => { passed += 1; };

    limiter({}, response, next);
    limiter({}, response, next);
    limiter({}, response, next);
    assert.equal(passed, 2);
    assert.equal(calls[0].code, 429);

    limiter.reset();
    limiter({}, response, next);
    assert.equal(passed, 3);
  });
});

describe('validación de archivos', () => {
  const PDF = Buffer.from('%PDF-1.7\n');
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

  it('normalizeMime quita parámetros y mayúsculas', () => {
    assert.equal(normalizeMime('Application/PDF; charset=binary'), 'application/pdf');
    assert.equal(normalizeMime(undefined), '');
  });

  it('hasValidSignature exige un tipo permitido y la firma real del contenido', () => {
    assert.equal(hasValidSignature('application/pdf', PDF, ['application/pdf']), true);
    assert.equal(hasValidSignature('application/pdf', PNG, ['application/pdf']), false);
    assert.equal(hasValidSignature('image/png', PNG, ['application/pdf']), false);
    assert.equal(hasValidSignature('text/plain', PDF, ['text/plain']), false);
  });

  it('cleanFileName decodifica, limita y quita caracteres peligrosos', () => {
    assert.equal(cleanFileName(encodeURIComponent('RUT 2026.pdf'), 'x.pdf'), 'RUT 2026.pdf');
    assert.equal(cleanFileName(encodeURIComponent('../a"b\r\n.pdf'), 'x.pdf'), '.._a_b__.pdf');
    assert.equal(cleanFileName('%E0%A4%A', 'x.pdf'), 'x.pdf');
    assert.equal(cleanFileName('', 'x.pdf'), 'x.pdf');
    assert.equal(cleanFileName('a'.repeat(300), 'x.pdf').length, 200);
  });
});
