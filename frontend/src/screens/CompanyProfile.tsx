import { useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import ChangePasswordCard from "../components/ChangePasswordCard";
import NavBar from "../components/NavBar";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
  updateOrganizationProfile: (payload: Record<string, unknown>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

const inputClass = "w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white";
const labelClass = "block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5";

// Datos de la organización: antes no existía una pantalla para editarlos.
export default function CompanyProfile({ state, navigate, updateOrganizationProfile, changePassword }: Props) {
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
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="company" navigate={navigate} activeScreen="company-profile" userName={user?.organizacionNombre ?? user?.nombreCompleto ?? "Empresa"} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[#0d2240] mb-1">Mi empresa</h1>
        <p className="text-[#64748b] text-sm mb-6">Estos datos acompañan cada oferta que publicas.</p>

        <div className={`rounded-2xl border p-4 mb-6 text-sm ${verified ? "bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]" : "bg-amber-50 border-amber-200 text-amber-800"}`} role="status">
          {verified
            ? "✓ Organización verificada. Tus ofertas muestran el sello de verificación."
            : "Tu organización aún no está verificada. Completa la identificación fiscal y el sitio web para facilitar la revisión por parte del equipo de SIPU."}
        </div>

        <form onSubmit={save} className="bg-white rounded-3xl border border-[#e8eef4] shadow-sm p-7" noValidate>
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
              <input id="org-email" disabled className={`${inputClass} bg-gray-100 text-[#64748b] cursor-not-allowed`} value={user?.email ?? ""} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {message && <span role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-[#16a34a]" : "text-red-600"}`}>{message.text}</span>}
            <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg, #0d2240 0%, #163456 100%)" }}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>

        <ChangePasswordCard onChange={changePassword} />
      </div>
    </div>
  );
}
