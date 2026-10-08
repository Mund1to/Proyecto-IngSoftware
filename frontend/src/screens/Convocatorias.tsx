import { useEffect, useState } from "react";
import { AppState, Screen } from "../App";
import NavBar from "../components/NavBar";
import { api } from "../lib/api";

type Props = {
  state: AppState;
  navigate: (screen: Screen, extra?: Partial<AppState>) => void;
};

type Convocatoria = {
  id: number;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  total_ofertas: string | number;
};

const emptyDraft = { titulo: "", descripcion: "", fechaInicio: "", fechaFin: "" };

// #18 HU-14: gestión de convocatorias públicas (Fase 4).
export default function Convocatorias({ state, navigate }: Props) {
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.getConvocatorias()
      .then((response) => {
        setConvocatorias(response.convocatorias ?? []);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las convocatorias."));
  };

  useEffect(load, []);

  const reset = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setError("");
  };

  const save = async () => {
    if (!state.token) return;
    if (!draft.titulo.trim()) {
      setError("La convocatoria requiere un título.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId === null) {
        await api.createConvocatoria(draft, state.token);
      } else {
        await api.updateConvocatoria(editingId, draft, state.token);
      }
      reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la convocatoria.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (convocatoria: Convocatoria) => {
    setEditingId(convocatoria.id);
    setDraft({
      titulo: convocatoria.titulo,
      descripcion: convocatoria.descripcion ?? "",
      fechaInicio: convocatoria.fecha_inicio?.slice(0, 10) ?? "",
      fechaFin: convocatoria.fecha_fin?.slice(0, 10) ?? "",
    });
  };

  const remove = async (id: number) => {
    if (!state.token) return;
    setError("");
    try {
      await api.deleteConvocatoria(id, state.token);
      if (editingId === id) reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la convocatoria.");
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-sm text-[#1e293b] focus:border-[#0d2240] focus:bg-white";

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <NavBar role="company" navigate={navigate} activeScreen="convocatorias" userName={state.currentUser?.nombreCompleto ?? "Funcionario"} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[#0d2240] mb-1">Convocatorias públicas</h1>
        <p className="text-[#64748b] text-sm mb-6">Agrupa ofertas bajo convocatorias institucionales.</p>

        {error && <div className="form-error mb-5" role="alert">{error}</div>}

        <div className="bg-white rounded-2xl border border-[#e8eef4] shadow-sm p-6 mb-8">
          <h2 className="font-bold text-[#0d2240] mb-4">{editingId === null ? "Nueva convocatoria" : `Editando convocatoria #${editingId}`}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Título</label>
              <input className={inputClass} value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Fecha de inicio</label>
              <input type="date" className={inputClass} value={draft.fechaInicio} onChange={(e) => setDraft({ ...draft, fechaInicio: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Fecha de fin</label>
              <input type="date" className={inputClass} value={draft.fechaFin} onChange={(e) => setDraft({ ...draft, fechaFin: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5">Descripción</label>
              <textarea rows={3} className={inputClass} value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            {editingId !== null && (
              <button onClick={reset} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#64748b] border border-[#e2e8f0] hover:bg-[#f8fafc]">Cancelar</button>
            )}
            <button
              onClick={() => void save()}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0d2240 0%, #163456 100%)" }}
            >
              {saving ? "Guardando..." : editingId === null ? "Crear convocatoria" : "Guardar cambios"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {convocatorias.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e8eef4] text-center py-16">
              <p className="text-[#64748b] text-sm">Aún no hay convocatorias registradas.</p>
            </div>
          ) : (
            convocatorias.map((convocatoria) => (
              <div key={convocatoria.id} className="bg-white rounded-2xl border border-[#e8eef4] shadow-sm p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#0d2240]">{convocatoria.titulo}</h3>
                    {convocatoria.descripcion && <p className="text-sm text-[#475569] mt-1.5">{convocatoria.descripcion}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#94a3b8]">
                      <span>{convocatoria.total_ofertas} ofertas asociadas</span>
                      {convocatoria.fecha_inicio && <span>Inicio: {convocatoria.fecha_inicio.slice(0, 10)}</span>}
                      {convocatoria.fecha_fin && <span>Fin: {convocatoria.fecha_fin.slice(0, 10)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => startEdit(convocatoria)} className="text-xs font-semibold text-[#0d2240] border border-[#e2e8f0] rounded-lg px-3 py-1.5 hover:bg-[#f8fafc]">Editar</button>
                    <button onClick={() => void remove(convocatoria.id)} className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50">Eliminar</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
