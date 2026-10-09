// Valida que los parámetros numéricos de las rutas sean identificadores enteros.
// Sin esto PostgreSQL rechaza el valor y la API respondía 500.
// router.param solo aplica al router donde se registra, por eso cada router lo invoca.
export function registerIdParams(router, params = ['id', 'offerId', 'organizationId', 'userId']) {
  for (const param of params) {
    router.param(param, (_request, response, next, value) => {
      if (!/^\d{1,18}$/.test(String(value))) {
        return response.status(400).json({ ok: false, message: 'El identificador indicado no es válido.' });
      }
      return next();
    });
  }

  return router;
}
