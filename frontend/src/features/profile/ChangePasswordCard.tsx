import { useState } from "react";

type Props = { onChange: (currentPassword: string, newPassword: string) => Promise<void> };

const inputClass = "w-full px-4 py-3 rounded-xl border border-[#d3e0f5] bg-[#f8faff] text-sm text-[var(--text)] focus:border-[var(--primary)] focus:bg-white";
const labelClass = "block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5";

export default function ChangePasswordCard({ onChange }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!current) return setMessage({ ok: false, text: "Ingresa tu contraseña actual." });
    if (next.length < 8 || !/[A-Z]/.test(next) || !/\d/.test(next)) {
      return setMessage({ ok: false, text: "La nueva contraseña necesita 8 caracteres, una mayúscula y un número." });
    }
    if (next !== confirm) return setMessage({ ok: false, text: "Las contraseñas nuevas no coinciden." });

    setSaving(true);
    try {
      await onChange(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ ok: true, text: "Contraseña actualizada." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "No se pudo cambiar la contraseña." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-[24px] border border-[#d3e0f5] shadow-sm p-7 mt-6" noValidate>
      <h2 className="font-bold text-[var(--navy)] mb-1">Cambiar contraseña</h2>
      <p className="text-sm text-[var(--muted)] mb-5">Por seguridad, confirma tu contraseña actual.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div>
          <label className={labelClass} htmlFor="password-current">Contraseña actual</label>
          <input id="password-current" type="password" autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="password-new">Nueva contraseña</label>
          <input id="password-new" type="password" autoComplete="new-password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="password-confirm">Confirmar nueva</label>
          <input id="password-confirm" type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3">
        {message && <span role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{message.text}</span>}
        <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(145deg, #123b70, #4d87ff)" }}>
          {saving ? "Guardando..." : "Actualizar contraseña"}
        </button>
      </div>
    </form>
  );
}
