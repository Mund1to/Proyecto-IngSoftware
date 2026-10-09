import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scoreOffer } from '../src/controllers/offers.controller.js';
import { createRateLimiter } from '../src/middleware/rateLimit.middleware.js';
import { normalizeModality } from '../src/utils/offers.js';
import {
  getBodyValue,
  hasBodyValue,
  normalizeNumber,
  normalizeStringList,
  toNullableString,
} from '../src/utils/payload.js';

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
