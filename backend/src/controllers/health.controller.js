export function getHealth(_request, response) {
  response.status(200).json({
    service: 'sipu-backend',
    status: 'ok',
  });
}
