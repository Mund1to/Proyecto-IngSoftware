// Tamaño legible de un archivo: 1.5 MB, 320 KB (nunca 0 KB).
export const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
