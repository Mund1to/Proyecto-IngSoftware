import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ArdyBubble from "./ArdyBubble";
import DueBadge, { dueState } from "./DueBadge";
import ProgressMeter from "./ProgressMeter";

afterEach(cleanup);

const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

describe("DueBadge", () => {
  it("indica el estado con texto, no solo con color", () => {
    expect(dueState(inDays(5))).toEqual({ tone: "soon", text: "Cierra en 5 días" });
    expect(dueState(inDays(40)).text).toBe("Abierta");
    expect(dueState(inDays(-2)).text).toBe("Cerrada");
    expect(dueState("").text).toBe("Abierta");
  });

  it("muestra el texto del estado", () => {
    render(<DueBadge closeDate={inDays(-1)} />);
    expect(screen.getByText("Cerrada").className).toContain("due-badge-closed");
  });
});

describe("ProgressMeter", () => {
  it("expone el avance como progressbar y limita el valor a 0-100", () => {
    render(<ProgressMeter value={140} label="Afinidad con tu perfil" />);
    const bar = screen.getByRole("progressbar", { name: "Afinidad con tu perfil" });
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText("100%")).toBeTruthy();
  });
});

describe("ArdyBubble", () => {
  it("muestra el globo y a Ardy con nombre accesible", () => {
    render(<ArdyBubble title="¡Encontré 3 ofertas para ti!" text="Encajan con tu perfil." />);
    expect(screen.getByText("¡Encontré 3 ofertas para ti!")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Ardy/ })).toBeTruthy();
  });
});
