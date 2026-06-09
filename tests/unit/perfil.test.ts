import { describe, expect, it } from "vitest";
import { perfilLabel } from "@/lib/perfil";

describe("perfilLabel", () => {
  it("uses the business-facing labels without changing technical profile values", () => {
    expect(perfilLabel("supervisor")).toBe("Coordenação");
    expect(perfilLabel("monitor")).toBe("Monitor");
    expect(perfilLabel("fiscal")).toBe("Fiscal");
  });
});
