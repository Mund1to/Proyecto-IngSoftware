// Lee ?page= y ?limit= de la consulta. Valores ausentes o inválidos toman el
// valor por defecto y el límite nunca supera `maxLimit`, para que un cliente no
// pueda pedir la tabla completa de una vez. La página también se acota para que
// el desplazamiento no desborde el BIGINT de PostgreSQL.
const MAX_PAGE = 100000;

export function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 50 } = {}) {
  const page = Math.min(toPositiveInteger(query.page) ?? 1, MAX_PAGE);
  const limit = Math.min(toPositiveInteger(query.limit) ?? defaultLimit, maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
