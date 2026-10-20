// Reglas de dependencia entre capas (ver frontend/README.md):
// - shared/ no conoce la app ni las funcionalidades.
// - una funcionalidad no importa pantallas de otra; sí su API, su modelo o sus componentes.
import { describe, expect, it } from "vitest";

const sources = import.meta.glob("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const IMPORT_RE = /from\s+["'](\.{1,2}\/[^"']+)["']/g;

// "../features/offers/OfferDetail" relativo a "../app/routes.tsx" -> "features/offers/OfferDetail"
function resolve(fromFile: string, spec: string): string {
  const parts = fromFile.replace(/^\.\.\//, "").split("/").slice(0, -1);
  for (const segment of spec.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== ".") parts.push(segment);
  }
  return parts.join("/");
}

function importsOf(file: string): string[] {
  return [...sources[file].matchAll(IMPORT_RE)].map(([, spec]) => resolve(file, spec));
}

const files = Object.keys(sources).filter((file) => !file.includes(".test."));
const screens = new Set(importsOf("../app/routes.tsx").filter((target) => target.startsWith("features/")));
const featureOf = (path: string) => path.split("/")[1];

describe("arquitectura del frontend", () => {
  it("encuentra las pantallas registradas", () => {
    expect(screens.size).toBeGreaterThan(10);
  });

  it("shared/ no importa de app/ ni de features/", () => {
    const violations = files
      .filter((file) => file.startsWith("../shared/"))
      .flatMap((file) => importsOf(file)
        .filter((target) => target.startsWith("app/") || target.startsWith("features/"))
        .map((target) => `${file} -> ${target}`));
    expect(violations).toEqual([]);
  });

  it("una funcionalidad no importa pantallas de otra", () => {
    const violations = files
      .filter((file) => file.startsWith("../features/"))
      .flatMap((file) => {
        const own = featureOf(file.replace(/^\.\.\//, ""));
        return importsOf(file)
          .filter((target) => target.startsWith("features/") && featureOf(target) !== own && screens.has(target))
          .map((target) => `${file} -> ${target}`);
      });
    expect(violations).toEqual([]);
  });
});
