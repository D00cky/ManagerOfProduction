import { describe, expect, it } from "vitest";
import { allowedPoloIds, buildOsScope, mergeScopeAndGeo } from "@/lib/scope";

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

  it("scopes monitor users to their assigned polos", () => {
    expect(
      buildOsScope({ id: "m1", perfil: "monitor", polosPermitidos: ["p1", "p2"] })
    ).toEqual({ poloId: { in: ["p1", "p2"] } });
  });

  it("scopes a monitor without any polo to nothing", () => {
    expect(buildOsScope({ id: "m1", perfil: "monitor" })).toEqual({
      poloId: { in: [] }
    });
  });
});

describe("mergeScopeAndGeo", () => {
  it("returns a copy of the scope when there is no filter", () => {
    const scope = { fiscalId: "f1" };
    const where = mergeScopeAndGeo(scope, {});
    expect(where).toEqual({ fiscalId: "f1" });
    expect(where).not.toBe(scope);
  });

  it("adds polo and município as additional narrowings", () => {
    expect(mergeScopeAndGeo({}, { polo: "p1", municipio: "Santos" })).toEqual({
      poloId: "p1",
      cidade: "Santos"
    });
  });

  it("lets a supervisor narrow to any região", () => {
    expect(mergeScopeAndGeo({}, { regiao: "METROPOLITANA" })).toEqual({
      regiaoAdministrativa: "METROPOLITANA"
    });
  });

  it("narrows a polo within a monitor's polo scope", () => {
    const scope = { poloId: { in: ["p1", "p2"] } };
    expect(mergeScopeAndGeo(scope, { polo: "p1" })).toEqual({ poloId: "p1" });
  });

  it("collapses an out-of-scope polo filter to nothing", () => {
    const scope = { poloId: { in: ["p1", "p2"] } };
    expect(mergeScopeAndGeo(scope, { polo: "p9" })).toEqual({ poloId: { in: [] } });
  });

  it("ANDs a região filter on top of a monitor's polo scope (cannot escape it)", () => {
    const scope = { poloId: { in: ["p1", "p2"] } };
    expect(mergeScopeAndGeo(scope, { regiao: "BAIXADA SANTISTA" })).toEqual({
      poloId: { in: ["p1", "p2"] },
      regiaoAdministrativa: "BAIXADA SANTISTA"
    });
  });
});
