import { useEffect, useState } from "react";
import { api, type EducationItem, type ExperienceItem, type ProfileDetails, type SkillItem } from "../lib/api";

// Educación, experiencia y habilidades guardadas en el servidor (Fase 6).
// Reemplaza las listas que antes solo vivían en localStorage.

type Section = "education" | "experience" | "skills";

const inputClass = "w-full px-3 py-2.5 rounded-xl border border-[#d3e0f5] bg-white text-sm text-[var(--text)] focus:border-[var(--primary)]";
const labelClass = "block text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1";

// Claves usadas por la versión anterior, para ofrecer importar esos datos.
const legacyKeys = (prefix: "student" | "external", profileId: number | string) => ({
  education: `sipu-${prefix}-education-v2-${profileId}`,
  experience: `sipu-${prefix}-experience-v2-${profileId}`,
  skills: `sipu-${prefix}-skills-v2-${profileId}`,
});

function readLegacy(prefix: "student" | "external", profileId: number | string): ProfileDetails | null {
  try {
    const keys = legacyKeys(prefix, profileId);
    const education = JSON.parse(localStorage.getItem(keys.education) ?? "[]") as any[];
    const experience = JSON.parse(localStorage.getItem(keys.experience) ?? "[]") as any[];
    const categories = JSON.parse(localStorage.getItem(keys.skills) ?? "[]") as { label: string; skills: string[] }[];
    const details: ProfileDetails = {
      education: education.map((item) => ({ titulo: item.title, institucion: item.institution, periodo: item.period })),
      experience: experience.map((item) => ({ cargo: item.title, empresa: item.company, periodo: item.period, descripcion: item.description ?? item.desc ?? "" })),
      skills: categories.flatMap((category) => (category.skills ?? []).map((nombre) => ({ categoria: category.label, nombre }))),
    };
    return details.education.length || details.experience.length || details.skills.length ? details : null;
  } catch {
    return null;
  }
}

function clearLegacy(prefix: "student" | "external", profileId: number | string) {
  try {
    Object.values(legacyKeys(prefix, profileId)).forEach((key) => localStorage.removeItem(key));
  } catch {
    // Sin acceso al almacenamiento no hay nada que limpiar.
  }
}

type Props = {
  token: string | null;
  section: Section;
  skillCategories: string[];
  legacyPrefix: "student" | "external";
  profileId: number | string;
};

export default function ProfileSections({ token, section, skillCategories, legacyPrefix, profileId }: Props) {
  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [legacy, setLegacy] = useState<ProfileDetails | null>(null);

  useEffect(() => {
    if (!token) return;
    api.getProfileDetails(token)
      .then((response) => {
        setDetails(response.details);
        const empty = !response.details.education.length && !response.details.experience.length && !response.details.skills.length;
        setLegacy(empty ? readLegacy(legacyPrefix, profileId) : null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar tu hoja de vida."));
  }, [token, legacyPrefix, profileId]);

  const save = async <T,>(saver: (items: T[], token: string) => Promise<{ details: ProfileDetails }>, items: T[]) => {
    if (!token) return false;
    setSaving(true);
    setError("");
    try {
      const response = await saver(items, token);
      setDetails(response.details);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const importLegacy = async () => {
    if (!legacy || !token) return;
    const ok = await save(api.saveEducation, legacy.education)
      && await save(api.saveExperience, legacy.experience)
      && await save(api.saveSkills, legacy.skills);
    if (ok) {
      clearLegacy(legacyPrefix, profileId);
      setLegacy(null);
    }
  };

  if (!details) {
    return error ? <div className="form-error" role="alert">{error}</div> : <p className="text-sm text-[var(--muted)]">Cargando...</p>;
  }

  return (
    <div>
      {legacy && (
        <div className="mb-5 p-4 rounded-[20px] border border-[#f5d9a8] bg-[#fff4df] text-sm text-[var(--warning)] flex flex-wrap items-center justify-between gap-3" role="status">
          <span>Encontramos datos de tu hoja de vida guardados solo en este navegador.</span>
          <button className="button primary" disabled={saving} onClick={() => void importLegacy()}>Guardarlos en mi cuenta</button>
        </div>
      )}
      {error && <div className="form-error mb-4" role="alert">{error}</div>}
      {section === "education" && (
        <EditableList<EducationItem>
          items={details.education}
          saving={saving}
          addLabel="Agregar educación"
          emptyText="Aún no registras formación."
          fields={[
            { key: "titulo", label: "Título o programa" },
            { key: "institucion", label: "Institución" },
            { key: "periodo", label: "Periodo", placeholder: "2022 - actual" },
          ]}
          render={(item) => <><h4 className="font-bold text-[var(--navy)] text-sm">{item.titulo}</h4><p className="text-[var(--muted)] text-sm">{item.institucion}</p><p className="text-[var(--muted)] text-xs mt-1">{item.periodo}</p></>}
          onSave={(items) => save(api.saveEducation, items)}
        />
      )}
      {section === "experience" && (
        <EditableList<ExperienceItem>
          items={details.experience}
          saving={saving}
          addLabel="Agregar experiencia"
          emptyText="Aún no registras experiencia."
          fields={[
            { key: "cargo", label: "Cargo" },
            { key: "empresa", label: "Empresa o institución" },
            { key: "periodo", label: "Periodo", placeholder: "Ene 2024 - Jun 2024" },
            { key: "descripcion", label: "Descripción", multiline: true, optional: true },
          ]}
          render={(item) => <><h4 className="font-bold text-[var(--navy)] text-sm">{item.cargo}</h4><p className="text-[var(--muted)] text-sm font-medium">{item.empresa}</p><p className="text-[var(--muted)] text-xs mt-0.5">{item.periodo}</p>{item.descripcion && <p className="text-[#475467] text-sm mt-2 leading-relaxed">{item.descripcion}</p>}</>}
          onSave={(items) => save(api.saveExperience, items)}
        />
      )}
      {section === "skills" && (
        <SkillsEditor
          skills={details.skills}
          categories={skillCategories}
          saving={saving}
          onSave={(items) => save(api.saveSkills, items)}
        />
      )}
    </div>
  );
}

type FieldDef<T> = { key: keyof T & string; label: string; placeholder?: string; multiline?: boolean; optional?: boolean };

function EditableList<T extends Record<string, any>>({ items, fields, render, onSave, saving, addLabel, emptyText }: {
  items: T[];
  fields: FieldDef<T>[];
  render: (item: T) => React.ReactNode;
  onSave: (items: T[]) => Promise<boolean>;
  saving: boolean;
  addLabel: string;
  emptyText: string;
}) {
  // null: sin formulario; -1: nuevo elemento; n: edición del elemento n.
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const open = (index: number) => {
    const source = index >= 0 ? items[index] : ({} as T);
    setDraft(Object.fromEntries(fields.map((field) => [field.key, String(source[field.key] ?? "")])));
    setFormError("");
    setEditing(index);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (fields.some((field) => !field.optional && !draft[field.key]?.trim())) {
      setFormError("Completa los campos obligatorios.");
      return;
    }
    const entry = Object.fromEntries(fields.map((field) => [field.key, draft[field.key].trim()])) as unknown as T;
    const next = editing === -1 ? [...items, entry] : items.map((item, index) => (index === editing ? entry : item));
    if (await onSave(next)) setEditing(null);
  };

  const remove = async (index: number) => {
    if (!window.confirm("¿Eliminar este elemento?")) return;
    await onSave(items.filter((_item, position) => position !== index));
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    await onSave(next);
  };

  return (
    <div className="space-y-4">
      {items.length === 0 && editing === null && <p className="text-sm text-[var(--muted)]">{emptyText}</p>}
      {items.map((item, index) => (
        editing === index ? null : (
          <div key={item.id ?? index} className="flex items-start gap-4 p-5 rounded-[20px] bg-[#f8faff] border border-[#d3e0f5]">
            <div className="flex-1 min-w-0">{render(item)}</div>
            <div className="flex flex-col items-end gap-1 text-xs font-medium flex-shrink-0">
              <button disabled={saving} onClick={() => open(index)} className="text-[var(--navy)] hover:underline">Editar</button>
              <button disabled={saving} onClick={() => void remove(index)} className="text-[var(--danger)] hover:underline">Eliminar</button>
              <span className="flex gap-2 text-[var(--muted)]">
                <button disabled={saving || index === 0} aria-label="Subir" onClick={() => void move(index, -1)} className="disabled:opacity-30">↑</button>
                <button disabled={saving || index === items.length - 1} aria-label="Bajar" onClick={() => void move(index, 1)} className="disabled:opacity-30">↓</button>
              </span>
            </div>
          </div>
        )
      ))}

      {editing !== null ? (
        <form onSubmit={submit} className="p-5 rounded-[20px] border border-[var(--primary)]/20 bg-white space-y-3" noValidate>
          {fields.map((field) => (
            <div key={field.key}>
              <label className={labelClass} htmlFor={`field-${field.key}`}>{field.label}{field.optional ? " (opcional)" : ""}</label>
              {field.multiline ? (
                <textarea id={`field-${field.key}`} rows={3} className={inputClass} value={draft[field.key] ?? ""} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} />
              ) : (
                <input id={`field-${field.key}`} className={inputClass} placeholder={field.placeholder} value={draft[field.key] ?? ""} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} />
              )}
            </div>
          ))}
          {formError && <div className="form-error" role="alert">{formError}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancelar</button>
            <button type="submit" className="button primary" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      ) : (
        <button onClick={() => open(-1)} disabled={saving} className="w-full py-3.5 border-2 border-dashed border-[#d3e0f5] rounded-[20px] text-sm font-semibold text-[var(--muted)] hover:border-[var(--primary)]/30 hover:text-[var(--navy)]">
          + {addLabel}
        </button>
      )}
    </div>
  );
}

const skillStyles = ["bg-[var(--selection)] text-[var(--primary)]", "bg-[var(--selection)] text-[var(--primary)]", "bg-[#fff4df] text-[var(--warning)]", "bg-[#eaf7f0] text-[var(--success)]", "bg-[var(--sky)] text-[var(--primary-dark)]"];

function SkillsEditor({ skills, categories, saving, onSave }: {
  skills: SkillItem[];
  categories: string[];
  saving: boolean;
  onSave: (items: SkillItem[]) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const allCategories = [...new Set([...categories, ...skills.map((skill) => skill.categoria)])];

  const add = async (categoria: string) => {
    const nombre = (drafts[categoria] ?? "").trim();
    if (!nombre) return;
    if (skills.some((skill) => skill.categoria === categoria && skill.nombre.toLowerCase() === nombre.toLowerCase())) {
      setDrafts({ ...drafts, [categoria]: "" });
      return;
    }
    if (await onSave([...skills, { categoria, nombre }])) setDrafts({ ...drafts, [categoria]: "" });
  };

  return (
    <div className="space-y-7">
      {allCategories.map((categoria, index) => {
        const style = skillStyles[index % skillStyles.length];
        return (
          <div key={categoria}>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-bold text-[var(--navy)]">{categoria}</h4>
              <div className="flex-1 h-px bg-[#f8faff]" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {skills.filter((skill) => skill.categoria === categoria).map((skill) => (
                <span key={`${skill.categoria}-${skill.nombre}`} className={`text-sm pl-3.5 pr-2 py-1.5 rounded-full font-semibold flex items-center gap-1.5 ${style}`}>
                  {skill.nombre}
                  <button aria-label={`Quitar ${skill.nombre}`} disabled={saving} onClick={() => void onSave(skills.filter((item) => item !== skill))} className="opacity-60 hover:opacity-100">×</button>
                </span>
              ))}
              <form className="flex gap-1" onSubmit={(event) => { event.preventDefault(); void add(categoria); }}>
                <input
                  aria-label={`Nueva habilidad en ${categoria}`}
                  placeholder="Agregar..."
                  value={drafts[categoria] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [categoria]: e.target.value })}
                  className="text-sm px-3 py-1.5 rounded-full border border-dashed border-[var(--border)] bg-white w-36"
                />
                <button type="submit" disabled={saving} className="text-sm px-3 py-1.5 rounded-full font-semibold text-[var(--navy)] border border-[#d3e0f5] hover:bg-[var(--selection)]">+</button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}
