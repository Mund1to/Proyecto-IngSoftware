export function registerController(_request, response) {
  response.status(501).json({
    ok: false,
    message: 'Registro de usuarios aún no implementado en la Fase 1.',
  });
}

export function loginController(_request, response) {
  response.status(501).json({
    ok: false,
    message: 'Login aún no implementado en la Fase 1.',
  });
}
