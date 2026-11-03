// Formulario de oferta por pasos (Fase 8): tipo, oferta, perfil, condiciones y
// publicación, con opciones en lugar de texto libre, validación por paso, vista
// previa en vivo, calidad de la oferta y borrador (en el navegador y en el servidor).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError } from "../../../shared/api/client";
import { IconArrowRight, IconBook, IconBriefcase, IconBuilding, IconCheck, IconClose, IconGraduation, IconMonitor, IconPin, IconPlus } from "../../../shared/ui/icons";
import { ChipInput, ChoiceGroup, FormField, NumberStepper, formatThousands } from "../../../shared/ui/form";
import ProgressMeter from "../../../shared/ui/ProgressMeter";
import { formatDate } from "../../../shared/lib/format";
import { offersApi } from "../offers.api";
import {
  EXPERIENCE_LABELS,
  LANGUAGE_LEVEL_LABELS,
  OFFER_AUDIENCE,
  OFFER_TYPE_LABELS,
  PRACTICE_EXPERIENCE,
  WORK_SCHEDULE_LABELS,
  type ExperienceLevel,
  type LanguageLevel,
  type Modality,
  type Offer,
  type OfferType,
  type WorkSchedule,
} from "../offers.model";
import {
  AREAS,
  BENEFITS,
  CITIES,
  DURATION_SUGGESTIONS,
  LANGUAGES,
  PROGRAMS,
  REMOTE_CITY,
  SCHEDULE_SUGGESTIONS,
  descriptionTemplate,
  suggestedSkills,
  titleSuggestions,
} from "./offerForm.catalogs";
import {
  OFFER_LIMITS as L,
  STEPS,
  addDays,
  changeOfferType,
  digitsOnly,
  draftFromOffer,
  draftQuality,
  draftWarnings,
  emptyDraft,
  errorsForStep,
  isCustomArea,
  isCustomCity,
  mapApiErrors,
  meaningfulDescription,
  toPayload,
  validateDraft,
  type DraftErrors,
  type OfferDraft,
  type StepId,
} from "./offerForm.model";
import OfferPreview from "./OfferPreview";

export type SaveOutcome = "published" | "draft" | "updated";

type Props = {
  token: string;
  organization: { name: string; verified: boolean; email: string };
  // Oferta que se edita; sin ella se crea una nueva.
  editing?: Offer | null;
  // Clave del borrador local (por usuario).
  storageKey: string;
  onCancel: () => void;
  onSaved: (apiOffer: unknown, outcome: SaveOutcome) => void;
};

const TYPE_OPTIONS: { value: OfferType; description: string; icon: ReactNode }[] = [
  { value: "PRACTICA", description: "Para estudiantes de la universidad. Puede tener apoyo económico.", icon: <IconGraduation size={24} /> },
  { value: "EMPLEO", description: "Vacante laboral para estudiantes, egresados y profesionales.", icon: <IconBriefcase size={24} /> },
  { value: "EMPLEO_PUBLICO", description: "Vacante de una entidad pública o convocatoria del Estado.", icon: <IconBuilding size={24} /> },
  { value: "FORMACION", description: "Curso, taller o diplomado. Sin salario ni entrevista: las inscripciones se aceptan directamente.", icon: <IconBook size={24} /> },
];

const MODALITY_OPTIONS: { value: Modality; label: string; description: string; icon: ReactNode }[] = [
  { value: "Presencial", label: "Presencial", description: "En las instalaciones", icon: <IconBuilding size={20} /> },
  { value: "Híbrida", label: "Híbrida", description: "Algunos días en sitio", icon: <IconPin size={20} /> },
  { value: "Remota", label: "Remota", description: "Desde cualquier lugar", icon: <IconMonitor size={20} /> },
];

const CLOSE_SHORTCUTS = [{ label: "En 2 semanas", days: 14 }, { label: "En 1 mes", days: 30 }, { label: "En 2 meses", days: 60 }, { label: "En 3 meses", days: 90 }];

function readLocalDraft(key: string): OfferDraft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...emptyDraft(), ...(JSON.parse(raw) as Partial<OfferDraft>) } : null;
  } catch {
    return null;
  }
}

const daysFromToday = (date: string) => Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000);

export default function OfferForm({ token, organization, editing = null, storageKey, onCancel, onSaved }: Props) {
  const isEditing = Boolean(editing);
  const editingStatus = editing?.status ?? "PUBLICADA";
  const [restored] = useState(() => (isEditing ? null : readLocalDraft(storageKey)));
  const [draft, setDraft] = useState<OfferDraft>(() => editing ? draftFromOffer(editing, organization.email) : restored ?? emptyDraft(organization.email));
  const [stepIndex, setStepIndex] = useState(isEditing ? 1 : 0);
  const [reached, setReached] = useState(isEditing ? STEPS.length - 1 : 0);
  // Pasos en los que ya se intentó avanzar: solo ahí se muestran los errores.
  const [checked, setChecked] = useState<Set<StepId>>(() => new Set(isEditing ? STEPS.map((step) => step.id) : []));
  const [serverErrors, setServerErrors] = useState<DraftErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState<"" | "publish" | "draft">("");
  const [localSaved, setLocalSaved] = useState(Boolean(restored));
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = STEPS[stepIndex];
  const errors = useMemo(() => validateDraft(draft), [draft]);
  const warnings = useMemo(() => draftWarnings(draft), [draft]);
  const quality = useMemo(() => draftQuality(draft), [draft]);
  const visibleErrors: DraftErrors = { ...(checked.has(step.id) ? errorsForStep(errors, step.id) : {}), ...errorsForStep(serverErrors, step.id) };

  // Autoguardado local de una oferta nueva, para no perderla al recargar.
  useEffect(() => {
    if (isEditing) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setLocalSaved(true);
      } catch {
        setLocalSaved(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, isEditing, storageKey]);

  // Al cambiar de paso el foco va al título del paso (lectores de pantalla).
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  const update = <K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setServerErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError("");
  };

  const focusFirstError = () => window.setTimeout(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], .vf-choice.has-error input')?.focus();
  }, 0);

  const goTo = (index: number) => {
    setStepIndex(index);
    setReached((current) => Math.max(current, index));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    setChecked((current) => new Set(current).add(step.id));
    if (Object.keys(errorsForStep(errors, step.id)).length > 0) {
      focusFirstError();
      return;
    }
    goTo(Math.min(stepIndex + 1, STEPS.length - 1));
  };

  // Lleva al primer paso con errores y los muestra.
  const showErrors = (found: DraftErrors) => {
    const firstStep = STEPS.findIndex((item) => Object.keys(errorsForStep(found, item.id)).length > 0);
    setChecked(new Set(STEPS.map((item) => item.id)));
    if (firstStep >= 0) goTo(firstStep);
    focusFirstError();
  };

  const save = async (estado: "PUBLICADA" | "BORRADOR") => {
    setFormError("");
    if (estado === "PUBLICADA" && Object.keys(errors).length > 0) {
      setFormError("Revisa los campos marcados antes de publicar.");
      showErrors(errors);
      return;
    }
    if (estado === "BORRADOR" && (!draft.title.trim() || !draft.description.trim())) {
      setFormError("Para guardar el borrador en tu cuenta escribe al menos el título y la descripción.");
      return;
    }
    setSaving(estado === "PUBLICADA" ? "publish" : "draft");
    try {
      const payload = toPayload(draft, estado);
      const response = editing ? await offersApi.updateOffer(editing.id, payload, token) : await offersApi.createOffer(payload, token);
      if (!isEditing) {
        try { localStorage.removeItem(storageKey); } catch { /* sin almacenamiento */ }
      }
      onSaved(response.offer, estado === "BORRADOR" ? "draft" : isEditing && editingStatus === "PUBLICADA" ? "updated" : "published");
    } catch (error) {
      const fieldErrors = error instanceof ApiError ? mapApiErrors(error.errors) : {};
      setServerErrors(fieldErrors);
      setFormError(error instanceof Error ? error.message : "No se pudo guardar la oferta.");
      if (Object.keys(fieldErrors).length > 0) showErrors(fieldErrors);
    } finally {
      setSaving("");
    }
  };

  const discardLocalDraft = () => {
    try { localStorage.removeItem(storageKey); } catch { /* sin almacenamiento */ }
    setDraft(emptyDraft(organization.email));
    setChecked(new Set());
    setStepIndex(0);
    setReached(0);
    setLocalSaved(false);
  };

  const typeLabel = OFFER_TYPE_LABELS[draft.offerType].toLowerCase();
  const pageTitle = isEditing ? "Editar oferta" : `Nueva oferta de ${typeLabel}`;
  const publishLabel = isEditing && editingStatus === "PUBLICADA" ? "Guardar cambios" : "Publicar oferta";
  const stepErrorCount = (id: StepId) => (checked.has(id) ? Object.keys(errorsForStep(errors, id)).length : 0);

  return (
    <main className="container offer-form-page">
      <button className="back-link" onClick={onCancel}><IconArrowRight className="back-link-icon" size={18} />Volver al panel</button>

      <header className="offer-form-header">
        <div>
          <p className="eyebrow">{isEditing ? (editingStatus === "BORRADOR" ? "Borrador" : "Oferta publicada") : `Paso ${stepIndex + 1} de ${STEPS.length}`}</p>
          <h1 className="display">{pageTitle}</h1>
          <p className="muted">Los campos con * son obligatorios para publicar. {!isEditing && "Puedes guardar un borrador en cualquier momento."}</p>
        </div>
        {!isEditing && (
          <div className="offer-form-autosave" role="status">
            {localSaved ? <><IconCheck size={16} />Guardado en este navegador</> : "Sin cambios guardados"}
            {restored && <button type="button" className="text-button" onClick={discardLocalDraft}>Empezar de nuevo</button>}
          </div>
        )}
      </header>

      <nav aria-label="Pasos de la oferta">
        <ol className="form-stepper">
          {STEPS.map((item, index) => {
            const done = index < stepIndex || (index <= reached && index !== stepIndex && stepErrorCount(item.id) === 0 && index < reached);
            const errorCount = stepErrorCount(item.id);
            return (
              <li key={item.id} className={`${index === stepIndex ? "is-current" : ""} ${done ? "is-done" : ""} ${errorCount ? "has-error" : ""}`}>
                <button type="button" disabled={index > reached} aria-current={index === stepIndex ? "step" : undefined} onClick={() => goTo(index)}>
                  <span className="form-stepper-dot" aria-hidden="true">{done && !errorCount ? <IconCheck size={14} /> : index + 1}</span>
                  <span className="form-stepper-text"><strong>{item.title}</strong><small>{errorCount ? `${errorCount} por revisar` : item.hint}</small></span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="offer-form-layout">
        <form ref={formRef} className="offer-form-card panel-card" noValidate onSubmit={(event) => { event.preventDefault(); if (stepIndex === STEPS.length - 1) void save("PUBLICADA"); else next(); }}>
          <h2 className="offer-form-step-title" tabIndex={-1} ref={headingRef}>{stepIndex + 1}. {step.title}</h2>

          {step.id === "type" && (
            <ChoiceGroup<OfferType>
              legend="¿Qué quieres publicar?"
              name="offer-type"
              variant="cards"
              required
              value={draft.offerType}
              onChange={(value) => setDraft((current) => changeOfferType(current, value))}
              options={TYPE_OPTIONS.map((option) => ({ value: option.value, label: OFFER_TYPE_LABELS[option.value], description: `${option.description} Visible para: ${OFFER_AUDIENCE[option.value].toLowerCase()}`, icon: option.icon }))}
            />
          )}

          {step.id === "offer" && (
            <div className="offer-form-grid">
              <FormField label={draft.offerType === "FORMACION" ? "Nombre del curso o programa" : "Título del cargo"} required error={visibleErrors.title} counter={{ value: draft.title.trim().length, max: L.titleMax }}
                hint="Usa el nombre con que buscarían la oferta, sin mayúsculas sostenidas ni signos de más.">
                {({ id, describedBy, invalid }) => (
                  <>
                    <input id={id} value={draft.title} maxLength={L.titleMax + 20} aria-describedby={describedBy} aria-invalid={invalid}
                      placeholder={titleSuggestions(draft.offerType, draft.area)[0]} onChange={(event) => update("title", event.target.value)} />
                    {draft.area && (
                      <div className="vf-suggestions" role="group" aria-label="Títulos sugeridos">
                        {titleSuggestions(draft.offerType, draft.area).map((suggestion) => (
                          <button key={suggestion} type="button" className="vf-suggestion" onClick={() => update("title", suggestion)}>{suggestion}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </FormField>

              <AreaField value={draft.area} error={visibleErrors.area} onChange={(value) => update("area", value)} />

              <FormField label={draft.offerType === "FORMACION" ? "Descripción del programa" : "Descripción"} required error={visibleErrors.description} className="full-span"
                counter={{ value: meaningfulDescription(draft.description).length, max: L.descriptionMax }}
                hint={<DescriptionHint text={draft.description} />}>
                {({ id, describedBy, invalid }) => (
                  <>
                    <textarea id={id} rows={8} value={draft.description} aria-describedby={describedBy} aria-invalid={invalid}
                      placeholder={draft.offerType === "FORMACION" ? "Qué se aprenderá, a quién va dirigido y cómo se certifica." : "Qué hará la persona, qué aprenderá y qué ofrece tu empresa."}
                      onChange={(event) => update("description", event.target.value)} />
                    <div className="vf-inline-actions">
                      <button type="button" className="vf-suggestion" onClick={() => {
                        if (draft.description.trim() && !window.confirm("¿Reemplazar la descripción por la guía? Se perderá el texto actual.")) return;
                        update("description", descriptionTemplate(draft.offerType));
                      }}><IconPlus size={13} />Usar una guía para redactarla</button>
                    </div>
                  </>
                )}
              </FormField>

              <NumberStepper label={draft.offerType === "FORMACION" ? "Cupos" : "Vacantes"} value={draft.vacancies} min={1} max={L.vacanciesMax}
                unit={draft.offerType === "FORMACION" ? ["cupo", "cupos"] : ["vacante", "vacantes"]} error={visibleErrors.vacancies}
                hint="Te ayuda a saber cuándo cubriste la oferta." onChange={(value) => update("vacancies", value)} />
            </div>
          )}

          {step.id === "profile" && (
            <div className="offer-form-grid">
              <ChipInput label={draft.offerType === "FORMACION" ? "Temas que se aprenderán" : "Habilidades que buscas"} required
                values={draft.skills} onChange={(values) => update("skills", values)} suggestions={suggestedSkills(draft.area)}
                max={L.skillsMax} minChars={L.skillMinChars} maxChars={L.skillMaxChars} error={visibleErrors.skills}
                placeholder="Escribe y presiona Enter" hint="Elige de las sugerencias o escribe las tuyas. Se usan para calcular la afinidad con cada candidato." />

              <ChipInput label="Programas o carreras" values={draft.programs} onChange={(values) => update("programs", values)} suggestions={PROGRAMS}
                max={L.programsMax} minChars={3} maxChars={120} placeholder="Busca un programa"
                hint={draft.programs.length === 0 ? "Sin programas, la oferta queda abierta a cualquier carrera." : "Solo como referencia: cualquier estudiante puede postularse."} />

              {draft.offerType === "PRACTICA" && (
                <ChoiceGroup<string> legend="Semestre mínimo" name="min-semester" value={draft.minSemester === null ? "ANY" : String(draft.minSemester)}
                  onChange={(value) => update("minSemester", value === "ANY" ? null : Number(value))}
                  options={[{ value: "ANY", label: "Cualquiera" }, ...[4, 5, 6, 7, 8, 9, 10].map((semester) => ({ value: String(semester), label: `Desde ${semester}°` }))]}
                  error={visibleErrors.minSemester} />
              )}

              {draft.offerType !== "FORMACION" && (
                <ChoiceGroup<ExperienceLevel> legend="Experiencia requerida" name="experience" value={draft.experience}
                  onChange={(value) => update("experience", value)} error={visibleErrors.experience}
                  hint={draft.offerType === "PRACTICA" ? "Una práctica es para estudiantes: no se puede pedir más de un año." : undefined}
                  options={(Object.keys(EXPERIENCE_LABELS) as ExperienceLevel[]).map((value) => ({ value, label: EXPERIENCE_LABELS[value], disabled: draft.offerType === "PRACTICA" && !PRACTICE_EXPERIENCE.includes(value) }))} />
              )}

              <LanguagesField value={draft.languages} error={visibleErrors.languages} onChange={(value) => update("languages", value)} />

              <ChipInput label="Requisitos adicionales" values={draft.requirements} onChange={(values) => update("requirements", values)}
                max={L.requirementsMax} minChars={L.requirementMinChars} maxChars={L.requirementMaxChars} error={visibleErrors.requirements}
                placeholder="Ej.: Disponibilidad para viajar" hint="Opcional. Solo lo que no cubren las opciones anteriores." />
            </div>
          )}

          {step.id === "conditions" && (
            <div className="offer-form-grid">
              <ChoiceGroup<Modality> legend="Modalidad" name="modality" variant="cards" required value={draft.modality}
                onChange={(value) => {
                  update("modality", value);
                  if (value === "Remota" && !draft.city) update("city", REMOTE_CITY);
                }}
                options={MODALITY_OPTIONS} />

              <CityField value={draft.city} remote={draft.modality === "Remota"} error={visibleErrors.city} onChange={(value) => update("city", value)} />

              {draft.offerType !== "FORMACION" && (
                <ChoiceGroup<WorkSchedule> legend="Jornada" name="work-schedule" required={draft.offerType === "EMPLEO" || draft.offerType === "EMPLEO_PUBLICO"}
                  value={draft.workSchedule} onChange={(value) => update("workSchedule", value)} error={visibleErrors.workSchedule}
                  options={(Object.keys(WORK_SCHEDULE_LABELS) as WorkSchedule[]).map((value) => ({ value, label: WORK_SCHEDULE_LABELS[value] }))} />
              )}

              <SuggestedText label="Duración" value={draft.duration} suggestions={DURATION_SUGGESTIONS[draft.offerType]} placeholder="Ej.: 6 meses" maxLength={120}
                onChange={(value) => update("duration", value)} />
              <SuggestedText label="Horario" value={draft.schedule} suggestions={SCHEDULE_SUGGESTIONS} placeholder="Ej.: Lunes a viernes, 8:00 a. m. a 5:00 p. m." maxLength={120}
                onChange={(value) => update("schedule", value)} />

              <SalaryField draft={draft} error={visibleErrors.salary} maxError={visibleErrors.salaryMax} warning={warnings.salary} update={update} />

              <ChipInput label="Beneficios" values={draft.benefits} onChange={(values) => update("benefits", values)} suggestions={BENEFITS[draft.offerType]}
                max={L.benefitsMax} minChars={2} maxChars={60} placeholder="Escribe un beneficio" hint="Opcional, pero las ofertas con beneficios reciben más postulaciones." />
            </div>
          )}

          {step.id === "publish" && (
            <div className="offer-form-grid">
              <FormField label="Fecha de cierre" required error={visibleErrors.closeDate}
                hint={draft.closeDate && !errors.closeDate ? `Recibirás postulaciones durante ${daysFromToday(draft.closeDate)} días, hasta el ${formatDate(`${draft.closeDate}T12:00:00Z`)}.` : "Último día para postularse."}>
                {({ id, describedBy, invalid }) => (
                  <>
                    <input id={id} type="date" value={draft.closeDate} min={addDays(new Date(), 1)} max={addDays(new Date(), L.closeMaxDays)}
                      aria-describedby={describedBy} aria-invalid={invalid} onChange={(event) => update("closeDate", event.target.value)} />
                    <div className="vf-suggestions" role="group" aria-label="Atajos de fecha">
                      {CLOSE_SHORTCUTS.map((shortcut) => (
                        <button key={shortcut.days} type="button" className={`vf-suggestion ${draft.closeDate === addDays(new Date(), shortcut.days) ? "is-active" : ""}`}
                          onClick={() => update("closeDate", addDays(new Date(), shortcut.days))}>{shortcut.label}</button>
                      ))}
                    </div>
                  </>
                )}
              </FormField>

              <FormField label="Correo de contacto" required error={visibleErrors.contact} hint="Lo verán los candidatos para resolver dudas.">
                {({ id, describedBy, invalid }) => (
                  <>
                    <input id={id} type="email" autoComplete="email" value={draft.contact} aria-describedby={describedBy} aria-invalid={invalid}
                      onChange={(event) => update("contact", event.target.value)} />
                    {organization.email && draft.contact !== organization.email && (
                      <div className="vf-inline-actions"><button type="button" className="vf-suggestion" onClick={() => update("contact", organization.email)}>Usar {organization.email}</button></div>
                    )}
                  </>
                )}
              </FormField>

              <OfferSummary draft={draft} errors={errors} onEdit={(stepId) => goTo(STEPS.findIndex((item) => item.id === stepId))} />
            </div>
          )}

          {formError && <div className="form-error" role="alert">{formError}</div>}

          <div className="offer-form-actions">
            <button type="button" className="button secondary" disabled={stepIndex === 0} onClick={() => goTo(stepIndex - 1)}>Anterior</button>
            <span className="offer-form-actions-spacer" />
            {(!isEditing || editingStatus === "BORRADOR") && (
              <button type="button" className="button secondary" disabled={Boolean(saving)} onClick={() => void save("BORRADOR")}>
                {saving === "draft" ? "Guardando..." : "Guardar borrador"}
              </button>
            )}
            {stepIndex < STEPS.length - 1 ? (
              <button type="submit" className="button primary">Siguiente<IconArrowRight size={18} /></button>
            ) : (
              <button type="submit" className="button primary" disabled={Boolean(saving)}>{saving === "publish" ? "Guardando..." : publishLabel}</button>
            )}
          </div>
          {isEditing && stepIndex < STEPS.length - 1 && (
            <p className="offer-form-shortcut"><button type="button" className="text-button" disabled={Boolean(saving)} onClick={() => void save(editingStatus === "BORRADOR" ? "BORRADOR" : "PUBLICADA")}>{editingStatus === "BORRADOR" ? "Guardar borrador sin revisar todo" : "Guardar cambios ahora"}</button></p>
          )}
        </form>

        <aside className="offer-form-aside">
          <p className="offer-form-aside-label">Así la verán los candidatos</p>
          <OfferPreview draft={draft} company={organization.name} verified={organization.verified} />
          <div className="panel-card offer-quality">
            <ProgressMeter label="Calidad de la oferta" value={quality.percent} />
            {quality.tips.length > 0 ? (
              <ul>{quality.tips.slice(0, 3).map((tip) => <li key={tip}>{tip}</li>)}</ul>
            ) : <p><IconCheck size={16} />¡Tu oferta está completa!</p>}
          </div>
        </aside>
      </div>
    </main>
  );
}

function DescriptionHint({ text }: { text: string }) {
  const content = meaningfulDescription(text);
  const count = content.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length;
  const missing = Math.max(0, L.descriptionMinWords - count);
  return <>{count} {count === 1 ? "palabra" : "palabras"}{missing > 0 ? ` · faltan ${missing} para el mínimo` : " · cumple el mínimo"}. Los encabezados de la guía no cuentan.</>;
}

function AreaField({ value, error, onChange }: { value: string; error?: string; onChange: (value: string) => void }) {
  const [custom, setCustom] = useState(isCustomArea(value));
  return (
    <div className="full-span">
      <ChoiceGroup<string> legend="Área" name="area" required value={custom ? "__OTRA__" : value} error={error}
        onChange={(next) => {
          if (next === "__OTRA__") {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(next);
          }
        }}
        options={[...AREAS.map((area) => ({ value: area, label: area })), { value: "__OTRA__", label: "Otra área" }]} />
      {custom && (
        <FormField label="¿Cuál área?" required>
          {({ id, describedBy }) => <input id={id} value={value} maxLength={100} aria-describedby={describedBy} autoFocus onChange={(event) => onChange(event.target.value)} />}
        </FormField>
      )}
    </div>
  );
}

function CityField({ value, remote, error, onChange }: { value: string; remote: boolean; error?: string; onChange: (value: string) => void }) {
  const [custom, setCustom] = useState(isCustomCity(value));
  const selectValue = custom ? "__OTRA__" : value;
  return (
    <FormField label={remote ? "Ciudad de referencia" : "Ciudad"} required error={error} hint={remote ? "En una oferta remota puedes elegir todo el país." : undefined}>
      {({ id, describedBy, invalid }) => (
        <>
          <select id={id} value={selectValue} aria-describedby={describedBy} aria-invalid={invalid}
            onChange={(event) => {
              if (event.target.value === "__OTRA__") {
                setCustom(true);
                onChange("");
              } else {
                setCustom(false);
                onChange(event.target.value);
              }
            }}>
            <option value="" disabled>Elige una ciudad</option>
            {remote && <option value={REMOTE_CITY}>{REMOTE_CITY}</option>}
            {CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
            <option value="__OTRA__">Otra ciudad…</option>
          </select>
          {custom && <input aria-label="Nombre de la ciudad" value={value} maxLength={180} placeholder="Escribe la ciudad" onChange={(event) => onChange(event.target.value)} />}
        </>
      )}
    </FormField>
  );
}

function SuggestedText({ label, value, suggestions, placeholder, maxLength, onChange }: { label: string; value: string; suggestions: string[]; placeholder: string; maxLength: number; onChange: (value: string) => void }) {
  return (
    <FormField label={label} hint="Opcional.">
      {({ id, describedBy }) => (
        <>
          <input id={id} value={value} maxLength={maxLength} placeholder={placeholder} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)} />
          <div className="vf-suggestions" role="group" aria-label={`Sugerencias de ${label.toLowerCase()}`}>
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" className={`vf-suggestion ${value === suggestion ? "is-active" : ""}`} onClick={() => onChange(suggestion)}>{suggestion}</button>
            ))}
          </div>
        </>
      )}
    </FormField>
  );
}

function MoneyInput({ label, value, onChange, error, warning, required, hint }: { label: string; value: string; onChange: (value: string) => void; error?: string; warning?: string; required?: boolean; hint?: string }) {
  return (
    <FormField label={label} required={required} error={error} warning={warning} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <div className="vf-money">
          <span aria-hidden="true">$</span>
          <input id={id} inputMode="numeric" value={formatThousands(value)} aria-describedby={describedBy} aria-invalid={invalid} placeholder="0"
            onChange={(event) => onChange(digitsOnly(event.target.value).slice(0, 9))} />
          <span aria-hidden="true">COP / mes</span>
        </div>
      )}
    </FormField>
  );
}

type UpdateFn = <K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) => void;

function SalaryField({ draft, error, maxError, warning, update }: { draft: OfferDraft; error?: string; maxError?: string; warning?: string; update: UpdateFn }) {
  if (draft.offerType === "FORMACION") {
    return <p className="vf-note full-span">La formación no lleva remuneración: los candidatos verán "No aplica".</p>;
  }
  if (draft.offerType === "PRACTICA") {
    return (
      <div className="full-span offer-form-salary">
        <ChoiceGroup<"SI" | "NO"> legend="Apoyo económico" name="paid" value={draft.paid ? "SI" : "NO"} onChange={(value) => update("paid", value === "SI")}
          options={[{ value: "SI", label: "Con apoyo económico" }, { value: "NO", label: "Sin apoyo (práctica académica)" }]} />
        {draft.paid && <MoneyInput label="Apoyo económico mensual" required value={draft.salary} error={error} warning={warning} onChange={(value) => update("salary", value)} />}
      </div>
    );
  }
  return (
    <div className="full-span offer-form-salary offer-form-salary-range">
      <MoneyInput label="Salario mensual desde" required value={draft.salary} error={error} warning={warning} onChange={(value) => update("salary", value)} />
      <MoneyInput label="Hasta" value={draft.salaryMax} error={maxError} hint="Opcional. Un rango atrae a más candidatos." onChange={(value) => update("salaryMax", value)} />
    </div>
  );
}

function LanguagesField({ value, error, onChange }: { value: OfferDraft["languages"]; error?: string; onChange: (value: OfferDraft["languages"]) => void }) {
  const used = new Set(value.map((item) => item.idioma));
  const available = LANGUAGES.filter((language) => !used.has(language));
  return (
    <fieldset className={`vf-choice full-span ${error ? "has-error" : ""}`}>
      <legend className="vf-label">Idiomas</legend>
      {value.length === 0 && <small className="vf-hint">Opcional. Agrega un idioma si el cargo lo necesita.</small>}
      <ul className="vf-language-list">
        {value.map((item, index) => (
          <li key={`${item.idioma}-${index}`}>
            <select aria-label={`Idioma ${index + 1}`} value={item.idioma} onChange={(event) => onChange(value.map((current, position) => position === index ? { ...current, idioma: event.target.value } : current))}>
              {[item.idioma, ...available].filter(Boolean).map((language) => <option key={language} value={language}>{language}</option>)}
            </select>
            <select aria-label={`Nivel de ${item.idioma}`} value={item.nivel} onChange={(event) => onChange(value.map((current, position) => position === index ? { ...current, nivel: event.target.value as LanguageLevel } : current))}>
              {(Object.keys(LANGUAGE_LEVEL_LABELS) as LanguageLevel[]).map((level) => <option key={level} value={level}>{LANGUAGE_LEVEL_LABELS[level]}</option>)}
            </select>
            <button type="button" className="vf-icon-button" aria-label={`Quitar ${item.idioma}`} onClick={() => onChange(value.filter((_item, position) => position !== index))}><IconClose size={16} /></button>
          </li>
        ))}
      </ul>
      {value.length < L.languagesMax && available.length > 0 && (
        <button type="button" className="vf-suggestion" onClick={() => onChange([...value, { idioma: available[0], nivel: "B1" }])}><IconPlus size={13} />Agregar idioma</button>
      )}
      {error && <small className="vf-error" role="alert">{error}</small>}
    </fieldset>
  );
}

function OfferSummary({ draft, errors, onEdit }: { draft: OfferDraft; errors: DraftErrors; onEdit: (step: StepId) => void }) {
  const salary = draft.offerType === "FORMACION" ? "No aplica" : draft.offerType === "PRACTICA" && !draft.paid ? "Sin apoyo económico" : draft.salary ? `$${formatThousands(draft.salary)}${draft.salaryMax ? ` a $${formatThousands(draft.salaryMax)}` : ""}` : "Sin definir";
  const rows: { step: StepId; label: string; value: string }[] = [
    { step: "type", label: "Tipo", value: OFFER_TYPE_LABELS[draft.offerType] },
    { step: "offer", label: "Título", value: draft.title || "Sin título" },
    { step: "offer", label: "Área y vacantes", value: `${draft.area || "Sin área"} · ${draft.vacancies} ${draft.vacancies === 1 ? "vacante" : "vacantes"}` },
    { step: "profile", label: "Habilidades", value: draft.skills.join(", ") || "Ninguna" },
    { step: "profile", label: "Programas", value: draft.programs.join(", ") || "Cualquier programa" },
    { step: "conditions", label: "Modalidad y ciudad", value: `${draft.modality} · ${draft.city || "Sin ciudad"}` },
    { step: "conditions", label: "Remuneración", value: salary },
  ];
  const pending = Object.keys(errors).length;
  return (
    <section className="offer-summary full-span" aria-labelledby="offer-summary-title">
      <h3 id="offer-summary-title">Resumen antes de publicar</h3>
      <p className={pending ? "offer-summary-status has-error" : "offer-summary-status"}>
        {pending ? `Hay ${pending} ${pending === 1 ? "campo" : "campos"} por completar.` : "Todo listo para publicar."}
      </p>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
            <button type="button" className="text-button" aria-label={`Editar ${row.label.toLowerCase()}`} onClick={() => onEdit(row.step)}>Editar</button>
          </div>
        ))}
      </dl>
    </section>
  );
}
