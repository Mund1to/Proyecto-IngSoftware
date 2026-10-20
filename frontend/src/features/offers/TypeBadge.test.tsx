import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import TypeBadge from "./TypeBadge";

afterEach(cleanup);

describe("TypeBadge", () => {
  it("usa la etiqueta y el estilo según el código de la API", () => {
    render(<TypeBadge type="FORMACION" />);
    const badge = screen.getByText("Formación");
    expect(badge.className).toContain("type-badge-formacion");
  });

  it("acepta etiquetas ya traducidas y trata los demás tipos como empleo", () => {
    render(<TypeBadge type="Tiempo completo" />);
    expect(screen.getByText("Tiempo completo").className).toContain("type-badge-empleo");
  });
});
