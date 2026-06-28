import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { detectMapping, normalizeImportRow, type RawImportRow } from "@/lib/importacao";
import { hasPermission } from "@/lib/permissions";
import { getCurrentUser } from "@/server/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!hasPermission(user.perfil, "importacao:write")) {
    return NextResponse.json({ error: "Sem permissao para importar OS" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo XLSX obrigatorio" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  const worksheet = firstSheet ? workbook.Sheets[firstSheet] : undefined;
  const rows = worksheet ? XLSX.utils.sheet_to_json<RawImportRow>(worksheet, { defval: "" }) : [];
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const mapping = detectMapping(headers);
  const erros: Array<{ linha: number; erros: string[] }> = [];
  let descartadas = 0;
  const preview = rows.slice(0, 20).map((row, index) => {
    const normalized = normalizeImportRow(row, mapping);
    if (normalized.errors.length > 0) {
      erros.push({ linha: index + 1, erros: normalized.errors });
    } else if (normalized.row.foraDeEscopo) {
      descartadas += 1;
    }
    return normalized.row;
  });

  let invalidas = erros.length;
  for (const [index, row] of rows.slice(20).entries()) {
    const normalized = normalizeImportRow(row, mapping);
    if (normalized.errors.length > 0) {
      invalidas += 1;
      erros.push({ linha: index + 21, erros: normalized.errors });
    } else if (normalized.row.foraDeEscopo) {
      descartadas += 1;
    }
  }

  return NextResponse.json({
    mapping,
    total: rows.length,
    validas: rows.length - invalidas - descartadas,
    invalidas,
    descartadas,
    preview,
    erros
  });
}
