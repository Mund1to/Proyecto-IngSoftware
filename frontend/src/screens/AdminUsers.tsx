import { useCallback, useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";
import { api, type AdminUser } from "../lib/api";

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
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="admin" navigate={navigate} activeScreen="admin-users" userName={state.currentUser?.nombreCompleto ?? "Administrador"} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[#0d2240] mb-1">Usuarios</h1>
        <p className="text-[#64748b] text-sm mb-6">Asigna roles institucionales y gestiona el acceso de las cuentas.</p>

        {!isAdmin ? (
          <div className="bg-white rounded-2xl border border-[#e8eef4] text-center py-16 text-sm text-[#64748b]">
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
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-sm"
              />
              <button type="submit" className="button primary">Buscar</button>
            </form>

            {error && <div className="form-error mb-5" role="alert">{error}</div>}

            {loading ? (
              <div className="bg-white rounded-2xl border border-[#e8eef4] text-center py-16 text-[#64748b] text-sm">Cargando usuarios...</div>
            ) : users.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#e8eef4] text-center py-16 text-[#64748b] text-sm">No hay usuarios que coincidan.</div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => {
                  const busy = busyId === String(user.id);
                  const isSelf = String(user.id) === String(state.currentUser?.id);
                  return (
                    <div key={user.id} className={`bg-white rounded-2xl border border-[#e8eef4] shadow-sm p-5 ${user.activo ? "" : "opacity-70"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-[#0d2240]">{user.nombre_completo}{isSelf && <span className="text-xs text-[#64748b] font-normal"> (tú)</span>}</h3>
                          <p className="text-sm text-[#64748b] break-all">{user.email}</p>
                          <p className="text-xs text-[#94a3b8] mt-1">
                            {(user.profile_types ?? []).map((type) => profileLabels[type] ?? type).join(", ") || "Sin perfil"}
                            {!user.activo && " · Cuenta desactivada"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(roleLabels).map(([role, label]) => {
                            const active = user.roles.includes(role);
                            return (
                              <button
                                key={role}
                                disabled={busy}
                                aria-pressed={active}
                                onClick={() => void toggleRole(user, role)}
                                className={`text-xs font-semibold rounded-lg px-3 py-1.5 border disabled:opacity-50 ${active ? "bg-[#0d2240] text-white border-[#0d2240]" : "text-[#0d2240] border-[#e2e8f0] hover:bg-[#f8fafc]"}`}
                              >
                                {active ? `✓ ${label}` : label}
                              </button>
                            );
                          })}
                          <button
                            disabled={busy || isSelf}
                            onClick={() => void toggleActive(user)}
                            className={`text-xs font-semibold rounded-lg px-3 py-1.5 border disabled:opacity-40 ${user.activo ? "text-red-600 border-red-200 hover:bg-red-50" : "text-[#16a34a] border-[#bbf7d0] hover:bg-[#f0fdf4]"}`}
                          >
                            {user.activo ? "Desactivar" : "Activar"}
                          </button>
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
    </div>
  );
}
