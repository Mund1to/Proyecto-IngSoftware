import { useCallback, useEffect, useRef, useState } from "react";
import { type OrganizationVerification, type VerificationDocumentType, verificationsApi } from "./verifications.api";
import { formatSize } from "../../shared/lib/files";
import { formatDate } from "../../shared/lib/offers";
import {
  TONE_CLASSES,
  blockerLabel,
  documentTypeLabel,
  formatList,
  statusMeta,
  validateVerificationFile,
} from "./verification";
import { IconCheck, IconClock, IconFile } from "../../shared/ui/icons";

type Props = {
  token: string | null;
  // Cambia al guardar los datos de la empresa: el NIT es requisito para enviar.
  nit?: string | null;
};

const fieldClass = "w-full px-4 py-3 rounded-xl border border-[#d3e0f5] bg-[#f8faff] text-sm text-[var(--text)] focus:border-[var(--primary)] focus:bg-white";
const labelClass = "block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5";

// Fase 7: la empresa sube sus documentos (RUT, Cámara de Comercio...) y envía la
// solicitud de verificación que revisa el equipo de SIPU.
export default function OrganizationVerificationPanel({ token, nit }: Props) {
  const [verification, setVerification] = useState<OrganizationVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [documentType, setDocumentType] = useState<VerificationDocumentType>("RUT");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // Propone el primer documento obligatorio que falta.
  const apply = useCallback((next: OrganizationVerification) => {
    setVerification(next);
    const missing = next.requisitos.tipos.find((item) => item.obligatorio && next.faltantes.includes(item.tipo));
    setDocumentType(missing?.tipo ?? "OTRO");
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    verificationsApi.getMyVerification(token)
      .then((response) => { if (active) { apply(response.verification); setError(""); } })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "No se pudo cargar la verificación."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, nit, apply]);

  const run = async (action: () => Promise<OrganizationVerification>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      apply(await action());
      setNotice(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) return null;

  if (loading && !verification) {
    return <section className="bg-white rounded-[24px] border border-[#d3e0f5] shadow-sm p-7 mt-6 text-sm text-[var(--muted)]" aria-busy="true">Cargando la verificación...</section>;
  }

  if (!verification) {
    return <section className="bg-white rounded-[24px] border border-[#d3e0f5] shadow-sm p-7 mt-6"><div className="form-error" role="alert">{error}</div></section>;
  }

  const { estado, solicitud, documentos, requisitos, bloqueada, faltantes, puedeEnviar } = verification;
  const meta = statusMeta(estado);
  const pending = estado === "PENDIENTE";
  const approved = estado === "APROBADA";
  const requiredTypes = requisitos.tipos.filter((item) => item.obligatorio);
  const full = documentos.length >= requisitos.maxDocumentos;

  const selectFile = (file?: File) => {
    if (!file) return;
    const problem = validateVerificationFile(file, requisitos);
    if (problem) {
      setNotice("");
      return setError(problem);
    }
    void run(
      async () => (await verificationsApi.uploadVerificationDocument(documentType, file, token)).verification,
      `${documentTypeLabel(documentType, requisitos)} adjuntado.`,
    );
  };

  const remove = (id: number, name: string) => {
    if (!window.confirm(`¿Eliminar el documento "${name}"?`)) return;
    void run(async () => (await verificationsApi.deleteVerificationDocument(id, token)).verification, "Documento eliminado.");
  };

  const submit = () => {
    void run(async () => {
      const response = await verificationsApi.submitVerificationRequest(message, token);
      setMessage("");
      return response.verification;
    }, "Solicitud enviada. Te avisaremos por correo cuando el equipo de SIPU la revise.");
  };

  const withdraw = () => {
    if (!window.confirm("¿Retirar la solicitud? Podrás corregir los documentos y enviarla de nuevo.")) return;
    void run(async () => (await verificationsApi.withdrawVerificationRequest(token)).verification, "Solicitud retirada. Ya puedes modificar los documentos.");
  };

  const intro = {
    SIN_SOLICITUD: "Sube los documentos que acreditan a tu empresa y envía la solicitud. Al aprobarla, tus ofertas mostrarán el sello de organización verificada.",
    PENDIENTE: `Tu solicitud está en revisión desde el ${formatDate(solicitud?.enviadaAt)}. Te avisaremos por correo cuando haya una decisión; mientras tanto los documentos no se pueden modificar.`,
    APROBADA: `Tu organización está verificada${solicitud?.revisadaAt ? ` desde el ${formatDate(solicitud.revisadaAt)}` : ""}. Tus ofertas muestran el sello de organización verificada.`,
    RECHAZADA: "Tu solicitud no fue aprobada. Revisa las observaciones, corrige los documentos y envíala de nuevo.",
  }[estado];

  return (
    <section id="verificacion" aria-labelledby="verification-title" className="bg-white rounded-[24px] border border-[#d3e0f5] shadow-sm p-7 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h2 id="verification-title" className="text-xl font-bold text-[var(--navy)]">Verificación de la empresa</h2>
        <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${TONE_CLASSES[meta.tone]}`}>{meta.label}</span>
      </div>
      <p className="text-sm text-[var(--muted)] mb-5">{intro}</p>

      {estado === "RECHAZADA" && solicitud?.observaciones && (
        <div className={`rounded-xl border p-4 mb-5 text-sm ${TONE_CLASSES.danger}`}>
          <p className="font-bold mb-1">Observaciones del revisor</p>
          <p className="text-[#475467]">{solicitud.observaciones}</p>
        </div>
      )}

      {!approved && (
        <ul className="grid gap-2 sm:grid-cols-3 mb-6" aria-label="Requisitos para enviar la solicitud">
          {["NIT", ...requiredTypes.map((item) => item.tipo)].map((code) => {
            const done = !faltantes.includes(code);
            return (
              <li key={code} className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-semibold ${done ? TONE_CLASSES.success : TONE_CLASSES.neutral}`}>
                <span aria-hidden="true">{done ? <IconCheck size={16} /> : <IconClock size={16} />}</span>
                <span>{blockerLabel(code, requisitos)}<span className="sr-only">{done ? ": completo" : ": pendiente"}</span></span>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="text-sm font-bold text-[var(--navy)] mb-3">Documentos adjuntos ({documentos.length}/{requisitos.maxDocumentos})</h3>
      {documentos.length === 0 ? (
        <p className="text-sm text-[var(--muted)] mb-5">Aún no has adjuntado documentos.</p>
      ) : (
        <ul className="space-y-2 mb-5" aria-label="Documentos adjuntos">
          {documentos.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e3eaf5] bg-[#f8faff] px-4 py-3">
              <span className="text-[var(--primary)]" aria-hidden="true"><IconFile size={22} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--navy)] break-all">{document.nombre}</p>
                <p className="text-xs text-[var(--muted)]">{documentTypeLabel(document.tipo, requisitos)} · {formatSize(document.tamano)} · {formatDate(document.createdAt)}</p>
              </div>
              <div className="flex gap-3 text-xs font-semibold">
                <button type="button" className="text-[var(--navy)] hover:underline" aria-label={`Ver ${document.nombre}`} onClick={() => void verificationsApi.openMyVerificationDocument(document.id, token).catch((err) => setError(err.message))}>Ver</button>
                {!bloqueada && (
                  <button type="button" disabled={busy} className="text-[var(--danger)] hover:underline disabled:opacity-40" aria-label={`Eliminar ${document.nombre}`} onClick={() => remove(document.id, document.nombre)}>Eliminar</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!bloqueada && (
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div className="flex-1 min-w-[220px]">
            <label className={labelClass} htmlFor="verification-type">Tipo de documento</label>
            <select id="verification-type" className={fieldClass} value={documentType} onChange={(event) => setDocumentType(event.target.value as VerificationDocumentType)}>
              {requisitos.tipos.map((item) => (
                <option key={item.tipo} value={item.tipo}>{item.etiqueta}{item.obligatorio ? " (obligatorio)" : ""}</option>
              ))}
            </select>
          </div>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept={requisitos.formatos.join(",")}
            aria-label="Archivo del documento"
            onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ""; }}
          />
          <button type="button" disabled={busy || full} onClick={() => fileInput.current?.click()} className="button secondary">
            {busy ? "Procesando..." : "Adjuntar documento"}
          </button>
          <p className="w-full text-xs text-[var(--muted)]">
            {formatList(requisitos.formatos)} · máximo {requisitos.maxBytes / 1024 / 1024} MB por archivo · hasta {requisitos.maxDocumentos} documentos.
          </p>
        </div>
      )}

      {!bloqueada && (
        <div className="border-t border-[#e3eaf5] pt-5">
          <label className={labelClass} htmlFor="verification-message">Mensaje para el revisor (opcional)</label>
          <textarea
            id="verification-message"
            rows={3}
            maxLength={requisitos.maxMensaje}
            className={fieldClass}
            value={message}
            placeholder="Por ejemplo: el certificado de Cámara de Comercio fue expedido este mes."
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <p className="text-xs text-[var(--muted)]">
              {puedeEnviar ? "Todo listo para enviar." : `Falta: ${faltantes.map((code) => blockerLabel(code, requisitos)).join("; ")}.`}
            </p>
            <button type="button" disabled={!puedeEnviar || busy} onClick={submit} className="button primary">
              {estado === "RECHAZADA" ? "Enviar de nuevo" : "Enviar solicitud de verificación"}
            </button>
          </div>
        </div>
      )}

      {pending && solicitud?.enviadaPorEmpresa && (
        <div className="flex justify-end">
          <button type="button" disabled={busy} onClick={withdraw} className="button secondary">Retirar solicitud</button>
        </div>
      )}

      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <p className="mt-4 text-sm text-[var(--success)]" role="status">{notice}</p>}
    </section>
  );
}
