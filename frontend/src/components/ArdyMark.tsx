// Versión de Ardy sobre fondo blanco y centrada, para los círculos (recortada del arte original de la mascota).
import ardy from "../imports/ardy-avatar.png";

type Props = {
  className?: string;
  label?: string;
};

export default function ArdyMark({ className = "", label = "Ardy, mascota de la Universidad de Ibagué" }: Props) {
  return (
    <span className={`ardy-mark ${className}`} role="img" aria-label={label}>
      <img src={ardy} alt="" aria-hidden="true" />
    </span>
  );
}
