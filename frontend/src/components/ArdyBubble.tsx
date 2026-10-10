import type { ReactNode } from "react";
import ArdyMark from "./ArdyMark";

type Props = {
  title: ReactNode;
  text?: ReactNode;
  // "float": Ardy flota suavemente (se desactiva con prefers-reduced-motion).
  float?: boolean;
  size?: "md" | "lg";
  className?: string;
  children?: ReactNode;
};

// Ardy circular con un globo de diálogo encima.
export default function ArdyBubble({ title, text, float = true, size = "lg", className = "", children }: Props) {
  return (
    <div className={`ardy-bubble ardy-bubble-${size} ${className}`}>
      <div className="ardy-bubble-speech">
        <strong>{title}</strong>
        {text && <span>{text}</span>}
      </div>
      <ArdyMark className={`ardy-bubble-avatar${float ? " bob" : ""}`} />
      {children}
    </div>
  );
}
