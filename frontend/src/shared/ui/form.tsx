// Controles de formulario accesibles del diseño "vivo": campo con etiqueta,
// ayuda, error y contador; tarjetas y pastillas de opción (radios nativos);
// entrada de etiquetas con sugerencias y contador numérico.
import { useId, useState, type ReactNode, type KeyboardEvent } from "react";
import { IconClose, IconPlus } from "./icons";

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  warning?: string;
  counter?: { value: number; max: number };
  className?: string;
  // Recibe el id del control y los ids que lo describen (ayuda y error).
  children: (control: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

export function FormField({ label, required, hint, error, warning, counter, className = "", children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : warning ? `${id}-warning` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`vf-field ${error ? "has-error" : ""} ${className}`}>
      <div className="vf-label-row">
        <label htmlFor={id} className="vf-label">{label}{required && <span className="vf-required" aria-hidden="true"> *</span>}</label>
        {counter && <span className={`vf-counter ${counter.value > counter.max ? "is-over" : ""}`} aria-hidden="true">{counter.value}/{counter.max}</span>}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && <small id={hintId} className="vf-hint">{hint}</small>}
      {error && <small id={errorId} className="vf-error" role="alert">{error}</small>}
      {!error && warning && <small id={errorId} className="vf-warning">{warning}</small>}
    </div>
  );
}

// Grupo de opciones con radios nativos (las flechas del teclado los recorren).
type Option<T extends string> = { value: T; label: string; description?: string; icon?: ReactNode; disabled?: boolean };

type ChoiceProps<T extends string> = {
  legend: string;
  name: string;
  value: T | "";
  options: Option<T>[];
  onChange: (value: T) => void;
  variant?: "cards" | "pills";
  error?: string;
  hint?: string;
  required?: boolean;
};

export function ChoiceGroup<T extends string>({ legend, name, value, options, onChange, variant = "pills", error, hint, required }: ChoiceProps<T>) {
  const id = useId();
  return (
    <fieldset className={`vf-choice vf-choice-${variant} ${error ? "has-error" : ""}`} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className="vf-label">{legend}{required && <span className="vf-required" aria-hidden="true"> *</span>}</legend>
      <div className="vf-choice-options">
        {options.map((option) => (
          <label key={option.value} className={`vf-option ${value === option.value ? "is-selected" : ""} ${option.disabled ? "is-disabled" : ""}`}>
            <input type="radio" name={name} value={option.value} checked={value === option.value} disabled={option.disabled} onChange={() => onChange(option.value)} />
            {option.icon && <span className="vf-option-icon" aria-hidden="true">{option.icon}</span>}
            <span className="vf-option-text">
              <strong>{option.label}</strong>
              {option.description && <small>{option.description}</small>}
            </span>
          </label>
        ))}
      </div>
      {hint && !error && <small id={`${id}-hint`} className="vf-hint">{hint}</small>}
      {error && <small id={`${id}-error`} className="vf-error" role="alert">{error}</small>}
    </fieldset>
  );
}

type ChipInputProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max: number;
  minChars?: number;
  maxChars?: number;
  error?: string;
  hint?: string;
  required?: boolean;
  addLabel?: string;
};

// Etiquetas: Enter o coma agrega, el botón × quita, las sugerencias se agregan con un clic.
export function ChipInput({ label, values, onChange, suggestions = [], placeholder, max, minChars = 2, maxChars = 60, error, hint, required, addLabel = "Agregar" }: ChipInputProps) {
  const [text, setText] = useState("");
  const [localError, setLocalError] = useState("");
  const has = (value: string) => values.some((item) => item.toLocaleLowerCase("es") === value.toLocaleLowerCase("es"));
  const full = values.length >= max;

  const add = (raw: string) => {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value) return;
    if (value.length < minChars || value.length > maxChars) {
      setLocalError(`Escribe entre ${minChars} y ${maxChars} caracteres.`);
      return;
    }
    if (has(value)) {
      setLocalError(`"${value}" ya está en la lista.`);
      return;
    }
    if (full) {
      setLocalError(`Puedes agregar como máximo ${max}.`);
      return;
    }
    onChange([...values, value]);
    setText("");
    setLocalError("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(text);
    } else if (event.key === "Backspace" && !text && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  // Al escribir, las sugerencias se filtran por el texto (sin distinguir tildes).
  const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const query = plain(text.trim());
  const pending = suggestions.filter((suggestion) => !has(suggestion) && (!query || plain(suggestion).includes(query))).slice(0, 10);

  return (
    <FormField label={label} required={required} hint={hint} error={localError || error} counter={{ value: values.length, max }}>
      {({ id, describedBy, invalid }) => (
        <div className="vf-chips">
          {values.length > 0 && (
            <ul className="vf-chip-list" aria-label={`${label} agregadas`}>
              {values.map((value) => (
                <li key={value} className="vf-chip">
                  {value}
                  <button type="button" aria-label={`Quitar ${value}`} onClick={() => onChange(values.filter((item) => item !== value))}><IconClose size={14} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="vf-chip-entry">
            <input
              id={id}
              value={text}
              disabled={full}
              placeholder={full ? `Máximo ${max}` : placeholder}
              aria-describedby={describedBy}
              aria-invalid={invalid || Boolean(localError)}
              maxLength={maxChars + 10}
              onChange={(event) => { setText(event.target.value); setLocalError(""); }}
              onKeyDown={onKeyDown}
            />
            <button type="button" className="vf-chip-add" disabled={!text.trim() || full} onClick={() => add(text)}><IconPlus size={16} />{addLabel}</button>
          </div>
          {pending.length > 0 && !full && (
            <div className="vf-suggestions" role="group" aria-label={`Sugerencias para ${label.toLowerCase()}`}>
              {pending.map((suggestion) => (
                <button key={suggestion} type="button" className="vf-suggestion" onClick={() => add(suggestion)}>
                  <IconPlus size={13} />{suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </FormField>
  );
}

type StepperProps = { label: string; value: number; min: number; max: number; onChange: (value: number) => void; hint?: string; error?: string; unit?: [string, string] };

// Número con botones − y +; también se puede escribir.
export function NumberStepper({ label, value, min, max, onChange, hint, error, unit }: StepperProps) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <FormField label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="vf-stepper">
          <button type="button" aria-label={`Disminuir ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>−</button>
          <input id={id} type="number" inputMode="numeric" min={min} max={max} value={value} aria-describedby={describedBy} aria-invalid={invalid}
            onChange={(event) => onChange(clamp(Math.round(Number(event.target.value) || min)))} />
          <button type="button" aria-label={`Aumentar ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>+</button>
          {unit && <span className="vf-stepper-unit" aria-hidden="true">{value === 1 ? unit[0] : unit[1]}</span>}
        </div>
      )}
    </FormField>
  );
}

// Valor en pesos con separador de miles mientras se escribe.
export const formatThousands = (digits: string) => (digits ? Number(digits).toLocaleString("es-CO") : "");
