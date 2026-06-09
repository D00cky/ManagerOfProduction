import { describe, expect, it } from "vitest";
import { canTransitionStatus, defaultRedirect, hasPermission } from "@/lib/permissions";

describe("permissions", () => {
  it("routes fiscal users to the tabulação flow and monitor/supervisor users to dashboard", () => {
    expect(defaultRedirect("fiscal")).toBe("/tabulacao");
    expect(defaultRedirect("monitor")).toBe("/dashboard");
    expect(defaultRedirect("supervisor")).toBe("/dashboard");
  });

  it("does not grant supervisor-only configuration permission to monitor", () => {
    expect(hasPermission("monitor", "configuracoes:write")).toBe(false);
    expect(hasPermission("supervisor", "configuracoes:write")).toBe(true);
  });

  it("lets supervisor and monitor (but not fiscal) change a member's polo", () => {
    expect(hasPermission("supervisor", "equipe:write")).toBe(true);
    expect(hasPermission("monitor", "equipe:write")).toBe(true);
    expect(hasPermission("fiscal", "equipe:write")).toBe(false);
  });
});

describe("canTransitionStatus", () => {
  it("blocks finishing an OS without a saved tabulation", () => {
    expect(canTransitionStatus("EmExecucao", "Concluida", false)).toBe(false);
    expect(canTransitionStatus("EmExecucao", "Concluida", true)).toBe(true);
  });

  it("allows logical cancellation before terminal statuses", () => {
    expect(canTransitionStatus("NaFila", "Cancelada", false)).toBe(true);
    expect(canTransitionStatus("Concluida", "Cancelada", true)).toBe(false);
  });
});
