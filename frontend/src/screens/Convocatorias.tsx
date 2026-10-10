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

type LinkedOffer = { id: number | string; titulo: string; empresa: string; convocatoria_id?: number | string | null };

const emptyDraft = { titulo: "", descripcion: "", fechaInicio: "", fechaFin: "" };

// #18 HU-14: gestión de convocatorias públicas (Fase 4).
export default function Convocatorias({ state, navigate }: Props) {
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [linked, setLinked] = useState<LinkedOffer[]>([]);
  const [catalog, setCatalog] = useState<LinkedOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState("");

  const loadOffers = async (id: number) => {
    const [current, all] = await Promise.all([api.getConvocatoriaOffers(id), api.getOffers()]);
    setLinked(current.offers ?? []);
    setCatalog(all.offers ?? []);
    setSelectedOffer("");
  };

  const toggleOffers = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setError("");
    try {
      await loadOffers(id);
      setOpenId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las ofertas.");
    }
  };

  const changeOffer = async (id: number, offerId: string | number, action: "add" | "remove") => {
    if (!state.token) return;
    setError("");
    try {
      if (action === "add") await api.assignOfferToConvocatoria(id, offerId, state.token);
      else await api.unassignOfferFromConvocatoria(id, offerId, state.token);
      await loadOffers(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la convocatoria.");
    }
  };

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
    if (!window.confirm("¿Eliminar esta convocatoria? Las ofertas asociadas quedarán sin convocatoria.")) return;
    setError("");
    try {
      await api.deleteConvocatoria(id, state.token);
      if (editingId === id) reset();
      if (openId === id) setOpenId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la convocatoria.");
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-[#d3e0f5] bg-[#f8faff] text-sm text-[var(--text)] focus:border-[var(--primary)] focus:bg-white";

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <NavBar role="admin" navigate={navigate} activeScreen="convocatorias" userName={state.currentUser?.nombreCompleto ?? "Funcionario"} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="display text-3xl text-[var(--navy)] mb-1">Convocatorias públicas</h1>
        <p className="text-[var(--muted)] text-sm mb-6">Agrupa ofertas bajo convocatorias institucionales.</p>

        {error && <div className="form-error mb-5" role="alert">{error}</div>}

        <div className="bg-white rounded-[20px] border border-[#d3e0f5] shadow-sm p-6 mb-8">
          <h2 className="font-bold text-[var(--navy)] mb-4">{editingId === null ? "Nueva convocatoria" : `Editando convocatoria #${editingId}`}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5">Título</label>
              <input className={inputClass} value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5">Fecha de inicio</label>
              <input type="date" className={inputClass} value={draft.fechaInicio} onChange={(e) => setDraft({ ...draft, fechaInicio: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5">Fecha de fin</label>
              <input type="date" className={inputClass} value={draft.fechaFin} onChange={(e) => setDraft({ ...draft, fechaFin: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1.5">Descripción</label>
              <textarea rows={3} className={inputClass} value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            {editingId !== null && (
              <button onClick={reset} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[var(--muted)] border border-[#d3e0f5] hover:bg-[var(--selection)]">Cancelar</button>
            )}
            <button
              onClick={() => void save()}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(145deg, #123b70, #4d87ff)" }}
            >
              {saving ? "Guardando..." : editingId === null ? "Crear convocatoria" : "Guardar cambios"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {convocatorias.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-[#d3e0f5] text-center py-16">
              <p className="text-[var(--muted)] text-sm">Aún no hay convocatorias registradas.</p>
            </div>
          ) : (
            convocatorias.map((convocatoria) => (
              <div key={convocatoria.id} className="bg-white rounded-[20px] border border-[#d3e0f5] shadow-sm p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-[var(--navy)]">{convocatoria.titulo}</h3>
                    {convocatoria.descripcion && <p className="text-sm text-[#475467] mt-1.5">{convocatoria.descripcion}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-[var(--muted)]">
                      <span>{convocatoria.total_ofertas} ofertas asociadas</span>
                      {convocatoria.fecha_inicio && <span>Inicio: {convocatoria.fecha_inicio.slice(0, 10)}</span>}
                      {convocatoria.fecha_fin && <span>Fin: {convocatoria.fecha_fin.slice(0, 10)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    <button onClick={() => void toggleOffers(convocatoria.id)} aria-expanded={openId === convocatoria.id} className="text-xs font-semibold text-[var(--navy)] border border-[#d3e0f5] rounded-lg px-3 py-1.5 hover:bg-[var(--selection)]">{openId === convocatoria.id ? "Ocultar ofertas" : "Ofertas"}</button>
                    <button onClick={() => startEdit(convocatoria)} className="text-xs font-semibold text-[var(--navy)] border border-[#d3e0f5] rounded-lg px-3 py-1.5 hover:bg-[var(--selection)]">Editar</button>
                    <button onClick={() => void remove(convocatoria.id)} className="text-xs font-semibold text-[var(--danger)] border border-[#fecdca] rounded-lg px-3 py-1.5 hover:bg-[#fef3f2]">Eliminar</button>
                  </div>
                </div>
                {openId === convocatoria.id && (
                  <div className="mt-5 pt-4 border-t border-[#e3eaf5]">
                    {linked.length === 0 ? (
                      <p className="text-sm text-[var(--muted)] mb-3">No hay ofertas publicadas asociadas.</p>
                    ) : (
                      <ul className="space-y-2 mb-4">
                        {linked.map((offer) => (
                          <li key={offer.id} className="flex items-center justify-between gap-3 text-sm">
                            <span><strong className="text-[var(--navy)]">{offer.titulo}</strong> <span className="text-[var(--muted)]">· {offer.empresa}</span></span>
                            <button onClick={() => void changeOffer(convocatoria.id, offer.id, "remove")} className="text-xs font-semibold text-[var(--danger)] hover:underline">Quitar</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2">
                      <select aria-label="Oferta para asociar" value={selectedOffer} onChange={(e) => setSelectedOffer(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-[#d3e0f5] bg-[#f8faff] text-sm">
                        <option value="">Selecciona una oferta publicada</option>
                        {catalog.filter((offer) => !linked.some((item) => String(item.id) === String(offer.id))).map((offer) => (
                          <option key={offer.id} value={offer.id}>{offer.titulo} · {offer.empresa}{offer.convocatoria_id ? " (en otra convocatoria)" : ""}</option>
                        ))}
                      </select>
                      <button disabled={!selectedOffer} onClick={() => void changeOffer(convocatoria.id, selectedOffer, "add")} className="button primary disabled:opacity-50">Asociar</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
