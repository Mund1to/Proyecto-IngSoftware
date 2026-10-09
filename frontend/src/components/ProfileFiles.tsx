import { useEffect, useRef, useState } from "react";
import { api, type FileKind, type StoredFile } from "../lib/api";

// Subida de hoja de vida (PDF) y foto del perfil, guardadas en el servidor.

const RULES: Record<FileKind, { accept: string; maxMb: number; types: string[]; label: string }> = {
  cv: { accept: "application/pdf,.pdf", maxMb: 5, types: ["application/pdf"], label: "Hoja de vida" },
  foto: { accept: "image/png,image/jpeg,image/webp", maxMb: 2, types: ["image/png", "image/jpeg", "image/webp"], label: "Foto" },
};

export function validateFile(kind: FileKind, file: File): string | null {
  const rule = RULES[kind];
  if (!rule.types.includes(file.type)) return kind === "cv" ? "Selecciona un archivo PDF." : "Selecciona una imagen PNG, JPG o WEBP.";
  if (file.size > rule.maxMb * 1024 * 1024) return `El archivo no puede superar ${rule.maxMb} MB.`;
  return null;
}

const formatSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

type CardProps = {
  token: string | null;
  kind: FileKind;
  current?: StoredFile;
  onChanged: () => Promise<void>;
};

// Tarjeta para subir, ver, reemplazar y eliminar un archivo.
export function FileCard({ token, kind, current, onChanged }: CardProps) {
  const rule = RULES[kind];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const select = (file?: File) => {
    if (!file || !token) return;
    const problem = validateFile(kind, file);
    if (problem) return setError(problem);
    void run(() => api.uploadFile(kind, file, token));
  };

  return (
    <div className={`rounded-xl border-2 border-dashed p-4 text-center min-w-[180px] ${current ? "border-[#16a34a]/30 bg-[#f0fdf4]" : "border-[#e2e8f0] bg-[#f8fafc]"}`}>
      <input ref={input} type="file" accept={rule.accept} className="hidden" aria-label={`Subir ${rule.label.toLowerCase()}`} onChange={(event) => { select(event.target.files?.[0]); event.target.value = ""; }} />
      <div className="text-2xl mb-1" aria-hidden="true">{kind === "cv" ? "📄" : "🖼️"}</div>
      {current ? (
        <>
          <p className="text-xs font-bold text-[#16a34a] break-all">{current.nombre}</p>
          <p className="text-[10px] text-[#64748b] mt-0.5">{formatSize(current.tamano)} · guardado en tu cuenta</p>
          <div className="mt-2 flex justify-center gap-3 text-[11px] font-semibold">
            <button disabled={busy || !token} onClick={() => token && void api.openMyFile(kind, token).catch((err) => setError(err.message))} className="text-[#0d2240] hover:underline">Ver</button>
            <button disabled={busy} onClick={() => input.current?.click()} className="text-[#0d2240] hover:underline">Reemplazar</button>
            <button disabled={busy || !token} onClick={() => token && window.confirm(`¿Eliminar ${rule.label.toLowerCase()}?`) && void run(() => api.deleteFile(kind, token))} className="text-red-600 hover:underline">Eliminar</button>
          </div>
        </>
      ) : (
        <button disabled={busy} onClick={() => input.current?.click()} className="w-full">
          <p className="text-xs font-bold text-[#0d2240]">{busy ? "Subiendo..." : `Subir ${rule.label.toLowerCase()}`}</p>
          <p className="text-[10px] text-[#94a3b8]">{kind === "cv" ? "PDF" : "PNG, JPG o WEBP"} · máx {rule.maxMb} MB</p>
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

// Descarga la foto del perfil para mostrarla como avatar.
export function useProfilePhoto(token: string | null, photo?: StoredFile) {
  const [url, setUrl] = useState("");
  const stamp = photo ? `${photo.nombre}-${photo.tamano}-${photo.createdAt ?? photo.created_at ?? ""}` : "";

  useEffect(() => {
    if (!token || !stamp) {
      setUrl("");
      return;
    }
    let objectUrl = "";
    let active = true;
    api.getFile("foto", token)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(""));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, stamp]);

  return url;
}

// Avatar con la foto del perfil o las iniciales; un clic permite cambiar la foto.
export function ProfileAvatar({ token, photo, initials, onChanged, gradient }: {
  token: string | null;
  photo?: StoredFile;
  initials: string;
  onChanged: () => Promise<void>;
  gradient: string;
}) {
  const url = useProfilePhoto(token, photo);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const select = async (file?: File) => {
    if (!file || !token) return;
    const problem = validateFile("foto", file);
    if (problem) return setError(problem);
    setError("");
    try {
      await api.uploadFile("foto", file, token);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    }
  };

  return (
    <div className="relative w-fit">
      <div
        className="w-20 h-20 rounded-2xl border-4 border-white flex items-center justify-center shadow-lg"
        style={url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: gradient }}
        role="img"
        aria-label={url ? "Foto de perfil" : `Iniciales ${initials}`}
      >
        {!url && <span className="text-white font-bold text-2xl">{initials}</span>}
      </div>
      <button
        title="Cambiar foto"
        aria-label="Cambiar foto"
        onClick={() => input.current?.click()}
        className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-[#e2e8f0] rounded-full flex items-center justify-center shadow-sm hover:bg-[#f8fafc]"
      >
        <svg className="w-3.5 h-3.5 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        </svg>
      </button>
      <input ref={input} type="file" accept={RULES.foto.accept} className="hidden" onChange={(event) => { void select(event.target.files?.[0]); event.target.value = ""; }} />
      {error && <p className="absolute top-full mt-1 w-48 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export const findFile = (files: StoredFile[] | undefined, tipo: "CV" | "FOTO") => files?.find((file) => file.tipo === tipo);
