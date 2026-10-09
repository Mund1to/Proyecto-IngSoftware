import { KeyboardEvent, useEffect, useId, useRef } from "react";

export type FilterOption = { value: string; label: string; count?: number };

type Props = {
  label: string;
  value: string;
  options: FilterOption[];
  defaultValue: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
};

// Menú desplegable de un filtro: reemplaza al <select> nativo con un listbox
// accesible (flechas, Enter/Espacio, Escape y clic fuera).
export default function FilterDropdown({ label, value, options, defaultValue, open, onOpenChange, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const listId = useId();
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const current = options.find((option) => option.value === value) ?? options[0];

  // Solo al abrir: enfoca la opción elegida y escucha los clics fuera del menú.
  useEffect(() => {
    if (!open) return;
    const selected = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?? listRef.current?.querySelector<HTMLButtonElement>('[role="option"]');
    selected?.focus();

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChangeRef.current(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const close = () => {
    onOpenChange(false);
    triggerRef.current?.focus();
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const className = ["filter-trigger", value !== defaultValue && "is-active", open && "is-open"].filter(Boolean).join(" ");

  return (
    <div
      className="filter filter-dropdown"
      ref={rootRef}
      onBlur={(event) => { if (open && !rootRef.current?.contains(event.relatedTarget as Node | null) && event.relatedTarget) onOpenChange(false); }}
    >
      <span id={labelId}>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${listId}-value`}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) { event.preventDefault(); onOpenChange(true); }
          if (event.key === "Escape" && open) { event.preventDefault(); onOpenChange(false); }
        }}
      >
        <span id={`${listId}-value`} className="filter-trigger-value">{current?.label}</span>
        <svg className="filter-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div id={listId} ref={listRef} className="filter-panel" role="listbox" aria-label={label} onKeyDown={onListKeyDown}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={selected ? "filter-option is-selected" : "filter-option"}
                onClick={() => { onChange(option.value); close(); }}
              >
                <span className="filter-option-label">{option.label}</span>
                {option.count !== undefined && <span className="filter-count">{option.count}</span>}
                {selected && <svg className="filter-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
