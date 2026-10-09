// Se carga antes que cualquier módulo de la API (node --import) para que la
// conexión apunte a una base de pruebas y nunca a la de desarrollo.
import 'dotenv/config';

function deriveTestUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    throw new Error('Defina TEST_DATABASE_URL o DATABASE_URL para ejecutar las pruebas.');
  }

  const url = new URL(process.env.DATABASE_URL);
  const database = url.pathname.replace(/^\//, '') || 'sipu';
  url.pathname = `/${database}_test`;
  return url.toString();
}

const testUrl = deriveTestUrl();
const databaseName = new URL(testUrl).pathname.replace(/^\//, '');

// Las pruebas borran el esquema completo: se exige un nombre inequívoco.
if (!databaseName.endsWith('_test')) {
  throw new Error(`La base de pruebas debe terminar en _test (recibido: ${databaseName}).`);
}

process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'sipu-test-secret';
process.env.JWT_EXPIRES_IN = '1h';
