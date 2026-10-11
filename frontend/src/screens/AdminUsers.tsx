import { useCallback, useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";
import { IconClock } from "../components/icons";
import { api, type AdminUser } from "../lib/api";
import { formatDate } from "../lib/offers";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
};

const profileLabels: Record<string, string> = {
  ESTUDIANTE: "Estudiante",
  CANDIDATO_EXTERNO: "Candidato externo",
  ORGANIZACION: "Organización",
};

const roleLabels: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  FUNCIONARIO_PUBLICO: "Funcionario público",
};

// Administración de cuentas: asignar roles institucionales y activar o desactivar usuarios.
export default function AdminUsers({ state, navigate }: Props) {
  const isAdmin = state.currentUser?.roles.includes("ADMINISTRADOR") ?? false;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback((query = "") => {
    if (!state.token || !isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.getUsers(state.token, query)
      .then((response) => {
        setUsers(response.users ?? []);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios."))
      .finally(() => setLoading(false));
  }, [state.token, isAdmin]);

  useEffect(() => load(), [load]);

  const replaceUser = (updated: AdminUser) => {
    setUsers((current) => current.map((user) => String(user.id) === String(updated.id) ? updated : user));
  };

  const toggleRole = async (user: AdminUser, role: string) => {
    if (!state.token) return;
    const roles = user.roles.includes(role) ? user.roles.filter((item) => item !== role) : [...user.roles, role];
    setBusyId(String(user.id));
    setError("");
    try {
      const response = await api.updateUserRoles(user.id, roles, state.token);
      replaceUser(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron actualizar los roles.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (user: AdminUser) => {
    if (!state.token) return;
    setBusyId(String(user.id));
    setError("");
    try {
      const response = await api.updateUserActive(user.id, !user.activo, state.token);
      replaceUser(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la cuenta.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar role="admin" navigate={navigate} activeScreen="admin-users" userName={state.currentUser?.nombreCompleto ?? "Administrador"} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="display text-3xl text-[var(--navy)] mb-1">Usuarios</h1>
        <p className="text-[var(--muted)] text-sm mb-6">Asigna roles institucionales y gestiona el acceso de las cuentas.</p>

        {!isAdmin ? (
          <div className="bg-white rounded-[20px] border border-[#d3e0f5] text-center py-16 text-sm text-[var(--muted)]">
            Solo un administrador puede gestionar usuarios.
          </div>
        ) : (
          <>
            <form
              className="flex gap-3 mb-6"
              onSubmit={(event) => { event.preventDefault(); load(search.trim()); }}
            >
              <input
                aria-label="Buscar por nombre o correo"
                placeholder="Buscar por nombre o correo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#d3e0f5] bg-white text-sm"
              />
              <button type="submit" className="button primary">Buscar</button>
            </form>

            {error && <div className="form-error mb-5" role="alert">{error}</div>}
            {notice && <div className="success-panel mb-5" role="status"><p>{notice}</p></div>}

            {loading ? (
              <div className="bg-white rounded-[20px] border border-[#d3e0f5] text-center py-16 text-[var(--muted)] text-sm">Cargando usuarios...</div>
            ) : users.length === 0 ? (
              <div className="bg-white rounded-[20px] border border-[#d3e0f5] text-center py-16 text-[var(--muted)] text-sm">No hay usuarios que coincidan.</div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => {
                  const busy = busyId === String(user.id);
                  const isSelf = String(user.id) === String(state.currentUser?.id);
                  return (
                    <div key={user.id} className={`bg-white rounded-[20px] border border-[#d3e0f5] shadow-sm p-5 ${user.activo ? "" : "opacity-70"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-[var(--navy)]">{user.nombre_completo}{isSelf && <span className="text-xs text-[var(--muted)] font-normal"> (tú)</span>}</h3>
                          <p className="text-sm text-[var(--muted)] break-all">{user.email}</p>
                          <p className="text-xs text-[var(--muted)] mt-1">
                            {(user.profile_types ?? []).map((type) => profileLabels[type] ?? type).join(", ") || "Sin perfil"}
                            {!user.activo && " · Cuenta desactivada"}
                          </p>
                          {user.solicitud_contrasena && (
                            <p className="reset-request">
                              <IconClock size={14} />
                              Pidió cambiar su contraseña el {formatDate(user.solicitud_contrasena)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {Object.entries(roleLabels).map(([role, label]) => {
                            const active = user.roles.includes(role);
                            return (
                              <button
                                key={role}
                                disabled={busy}
                                aria-pressed={active}
                                onClick={() => void toggleRole(user, role)}
                                className={`text-xs font-semibold rounded-lg px-3 py-1.5 border disabled:opacity-50 ${active ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "text-[var(--navy)] border-[#d3e0f5] hover:bg-[var(--selection)]"}`}
                              >
                                {active ? `✓ ${label}` : label}
                              </button>
                            );
                          })}
                          <button
                            disabled={busy || isSelf}
                            onClick={() => void toggleActive(user)}
                            className={`text-xs font-semibold rounded-lg px-3 py-1.5 border disabled:opacity-40 ${user.activo ? "text-[var(--danger)] border-[#fecdca] hover:bg-[#fef3f2]" : "text-[var(--success)] border-[#b7e4c7] hover:bg-[#dff1e7]"}`}
                          >
                            {user.activo ? "Desactivar" : "Activar"}
                          </button>
                          {!isSelf && (
                            <button
                              disabled={busy}
                              onClick={() => { setNotice(""); setPasswordFor(user); }}
                              className={`text-xs font-semibold rounded-lg px-3 py-1.5 border disabled:opacity-40 ${user.solicitud_contrasena ? "bg-[#fff4df] text-[var(--warning)] border-[#f5d9a8] hover:bg-[#ffecc7]" : "text-[var(--navy)] border-[#d3e0f5] hover:bg-[var(--selection)]"}`}
                            >
                              Cambiar contraseña
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {passwordFor && state.token && (
        <PasswordModal
          user={passwordFor}
          token={state.token}
          onClose={() => setPasswordFor(null)}
          onDone={(updated) => {
            replaceUser(updated);
            setPasswordFor(null);
            setNotice(`Contraseña de ${updated.nombre_completo} actualizada. Se cerraron sus sesiones abiertas y se le avisó por correo. Entrégale la contraseña por un canal seguro y pídele que la cambie al entrar.`);
          }}
        />
      )}
    </div>
  );
}

// Genera una contraseña aleatoria que cumple las reglas (8+ caracteres, mayúscula y número).
function generatePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const random = new Uint32Array(12);
  crypto.getRandomValues(random);
  const chars = Array.from(random, (value, index) => (index === 0 ? upper : index === 1 ? digits : all)[value % (index === 0 ? upper.length : index === 1 ? digits.length : all.length)]);
  // Mezcla Fisher-Yates para que la mayúscula y el número no queden siempre al inicio.
  const swaps = new Uint32Array(chars.length);
  crypto.getRandomValues(swaps);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = swaps[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const isStrongPassword = (value: string) => value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value);

function PasswordModal({ user, token, onClose, onDone }: { user: AdminUser; token: string; onClose: () => void; onDone: (user: AdminUser) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!isStrongPassword(password)) return setError("La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setSaving(true);
    try {
      const response = await api.setUserPassword(user.id, password, token);
      onDone(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
  };

  const generate = () => {
    const value = generatePassword();
    setPassword(value);
    setConfirm(value);
    setShow(true);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="password-title" onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)} noValidate>
        <p className="eyebrow">Recuperación de acceso</p>
        <h2 id="password-title">Cambiar contraseña</h2>
        <p className="muted">
          Asigna una contraseña nueva a <strong>{user.nombre_completo}</strong> ({user.email}). Se cerrarán sus sesiones abiertas y recibirá un aviso por correo.
        </p>
        <label className="field">
          <span>Nueva contraseña</span>
          <input type={show ? "text" : "password"} value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          <span>Confirmar contraseña</span>
          <input type={show ? "text" : "password"} value={confirm} autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <div className="password-modal-tools">
          <label className="password-modal-show"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Mostrar</label>
          <button type="button" className="text-button" onClick={generate}>Generar una segura</button>
        </div>
        <ul className="password-rules" aria-label="Requisitos de contraseña">
          <li className={password.length >= 8 ? "valid" : ""}>Mínimo 8 caracteres</li>
          <li className={/[A-Z]/.test(password) ? "valid" : ""}>Una mayúscula</li>
          <li className={/\d/.test(password) ? "valid" : ""}>Un número</li>
        </ul>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button primary" disabled={saving}>{saving ? "Guardando..." : "Guardar contraseña"}</button>
        </div>
      </form>
    </div>
  );
}
