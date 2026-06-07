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
  it("scopes fiscal users by fiscalId", () => {
    expect(buildOsScope({ id: "f1", perfil: "fiscal", poloId: "p1" })).toEqual({ fiscalId: "f1" });
  });

  it("scopes monitor users by authorized polos", () => {
    expect(
      buildOsScope({
        id: "m1",
        perfil: "monitor",
        poloId: "p1",
        polosPermitidos: ["p2"]
      })
    ).toEqual({ poloId: { in: ["p2"] } });
  });
});
