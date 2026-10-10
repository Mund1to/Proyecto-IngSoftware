import { useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import ChangePasswordCard from "../components/ChangePasswordCard";
import NavBar from "../components/NavBar";
import { ProfileAvatar, findFile } from "../components/ProfileFiles";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
  updateOrganizationProfile: (payload: Record<string, unknown>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
};

const inputClass = "w-full px-4 py-3 rounded-xl border border-[#d3e0f5] bg-[#f8faff] text-sm text-[var(--text)] focus:border-[var(--primary)] focus:bg-white";
const labelClass = "block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5";

// Datos de la organización: antes no existía una pantalla para editarlos.
export default function CompanyProfile({ state, navigate, updateOrganizationProfile, changePassword, refreshCurrentUser }: Props) {
  const user = state.currentUser;
  const initialForm = () => ({
    razonSocial: user?.organizacionNombre ?? "",
    identificacionFiscal: user?.identificacionFiscal ?? "",
    sitioWeb: user?.sitioWeb ?? "",
    descripcion: user?.descripcionOrganizacion ?? "",
    nombreCompleto: user?.nombreCompleto ?? "",
    telefono: user?.telefono ?? "",
  });
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setForm(initialForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const update = (key: keyof ReturnType<typeof initialForm>, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!form.razonSocial.trim()) return setMessage({ ok: false, text: "La razón social es obligatoria." });
    if (!form.nombreCompleto.trim()) return setMessage({ ok: false, text: "El nombre del contacto es obligatorio." });
    if (form.sitioWeb && !/^https?:\/\//i.test(form.sitioWeb)) return setMessage({ ok: false, text: "El sitio web debe empezar por http:// o https://." });

    setSaving(true);
    try {
      await updateOrganizationProfile(form);
      setMessage({ ok: true, text: "Datos de la empresa guardados." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "No se pudieron guardar los cambios." });
    } finally {
      setSaving(false);
    }
  };

  const verified = Boolean(user?.organizacionVerificada);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar role="company" navigate={navigate} activeScreen="company-profile" userName={user?.organizacionNombre ?? user?.nombreCompleto ?? "Empresa"} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-5 mb-6">
          <ProfileAvatar
            token={state.token}
            photo={findFile(user?.archivos, "FOTO")}
            initials={(user?.organizacionNombre ?? "E").slice(0, 2).toUpperCase()}
            onChanged={refreshCurrentUser}
            gradient="linear-gradient(145deg, #123b70, #4d87ff)"
          />
          <div>
            <h1 className="display text-3xl text-[var(--navy)] mb-1">Mi empresa</h1>
            <p className="text-[var(--muted)] text-sm">Estos datos acompañan cada oferta que publicas. Usa el ícono de la cámara para subir el logo.</p>
          </div>
        </div>

        <div className={`rounded-[20px] border p-4 mb-6 text-sm ${verified ? "bg-[#eaf7f0] border-[#b7e4c7] text-[var(--success)]" : "bg-[#fff4df] border-[#f5d9a8] text-[var(--warning)]"}`} role="status">
          {verified
            ? "✓ Organización verificada. Tus ofertas muestran el sello de verificación."
            : "Tu organización aún no está verificada. Completa la identificación fiscal y el sitio web para facilitar la revisión por parte del equipo de SIPU."}
        </div>

        <form onSubmit={save} className="bg-white rounded-[24px] border border-[#d3e0f5] shadow-sm p-7" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div>
              <label className={labelClass} htmlFor="org-name">Razón social</label>
              <input id="org-name" className={inputClass} value={form.razonSocial} onChange={(e) => update("razonSocial", e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="org-nit">NIT / identificación fiscal</label>
              <input id="org-nit" className={inputClass} value={form.identificacionFiscal} onChange={(e) => update("identificacionFiscal", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="org-web">Sitio web</label>
              <input id="org-web" type="url" placeholder="https://" className={inputClass} value={form.sitioWeb} onChange={(e) => update("sitioWeb", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="org-description">Descripción</label>
              <textarea id="org-description" rows={4} className={inputClass} value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="org-contact">Persona de contacto</label>
              <input id="org-contact" className={inputClass} value={form.nombreCompleto} onChange={(e) => update("nombreCompleto", e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="org-phone">Teléfono</label>
              <input id="org-phone" type="tel" className={inputClass} value={form.telefono} onChange={(e) => update("telefono", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="org-email">Correo de la cuenta</label>
              <input id="org-email" disabled className={`${inputClass} bg-[#f2f6fc] text-[var(--muted)] cursor-not-allowed`} value={user?.email ?? ""} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {message && <span role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{message.text}</span>}
            <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(145deg, #123b70, #4d87ff)" }}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>

        <ChangePasswordCard onChange={changePassword} />
      </div>
    </div>
  );
}
