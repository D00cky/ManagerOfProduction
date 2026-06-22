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

  it("narrows a monitor within their scoped região", () => {
    const scope = { regiaoAdministrativa: { in: ["METROPOLITANA"] } };
    expect(mergeScopeAndGeo(scope, { regiao: "METROPOLITANA" })).toEqual({
      regiaoAdministrativa: "METROPOLITANA"
    });
  });

  it("collapses an out-of-scope região filter to nothing", () => {
    const scope = { regiaoAdministrativa: { in: ["METROPOLITANA"] } };
    expect(mergeScopeAndGeo(scope, { regiao: "BAIXADA SANTISTA" })).toEqual({
      regiaoAdministrativa: { in: [] }
    });
  });
});
