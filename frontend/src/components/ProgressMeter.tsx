type Props = {
  value: number;
  label: string;
  // Muestra la etiqueta y el porcentaje encima de la barra.
  showLabel?: boolean;
  className?: string;
};

// Barra de progreso de 8 px con relleno degradado.
export default function ProgressMeter({ value, label, showLabel = true, className = "" }: Props) {
  const percent = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  return (
    <div className={`progress-meter ${className}`}>
      {showLabel && (
        <div className="progress-meter-head">
          <span>{label}</span>
          <strong>{percent}%</strong>
        </div>
      )}
      <div className="progress-meter-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="progress-meter-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
