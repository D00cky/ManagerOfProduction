import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression guard: the npm-registry build of `xlsx` is stuck at 0.18.5, which
// carries a prototype-pollution (GHSA-4r6h-8v6p-xvw6) and a ReDoS
// (GHSA-5pgg-2g8v-p4x9) advisory. The patched build only ships from the SheetJS
// CDN, so we pin direct + transitive resolution there.
describe("xlsx dependency", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    dependencies: Record<string, string>;
    overrides?: Record<string, string>;
  };

  it("pins the direct dependency to the patched SheetJS CDN build", () => {
    const spec = pkg.dependencies.xlsx;
    expect(spec).toMatch(/^https:\/\/cdn\.sheetjs\.com\/xlsx-\d+\.\d+\.\d+\//);
    expect(spec).not.toMatch(/^\^?0\.18\./);
  });

  it("forces any transitive xlsx to the same pinned build", () => {
    expect(pkg.overrides?.xlsx).toBe("$xlsx");
  });
});
