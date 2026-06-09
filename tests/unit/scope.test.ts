import { describe, expect, it } from "vitest";
import { allowedPoloIds, buildOsScope } from "@/lib/scope";

describe("allowedPoloIds", () => {
  it("returns undefined for supervisor users to represent unrestricted scope", () => {
    expect(allowedPoloIds({ id: "u1", perfil: "supervisor" })).toBeUndefined();
  });

  it("uses explicit monitor polo access when present", () => {
    expect(
      allowedPoloIds({
        id: "u2",
        perfil: "monitor",
        poloId: "p1",
        polosPermitidos: ["p2", "p3"]
      })
    ).toEqual(["p2", "p3"]);
  });

  it("falls back to monitor own polo when explicit access is absent", () => {
    expect(allowedPoloIds({ id: "u2", perfil: "monitor", poloId: "p1" })).toEqual(["p1"]);
  });
});

describe("buildOsScope", () => {
  it("returns an empty filter for supervisor users (unrestricted)", () => {
    expect(buildOsScope({ id: "s1", perfil: "supervisor" })).toEqual({});
  });

  it("scopes fiscal users by fiscalId", () => {
    expect(buildOsScope({ id: "f1", perfil: "fiscal", poloId: "p1" })).toEqual({ fiscalId: "f1" });
  });

  it("scopes monitor users to their whole região", () => {
    expect(
      buildOsScope({ id: "m1", perfil: "monitor", regiao: "Campinas" })
    ).toEqual({ regiaoAdministrativa: { in: ["Campinas"] } });
  });

  it("scopes a monitor without a região to nothing", () => {
    expect(buildOsScope({ id: "m1", perfil: "monitor" })).toEqual({
      regiaoAdministrativa: { in: [] }
    });
  });
});
