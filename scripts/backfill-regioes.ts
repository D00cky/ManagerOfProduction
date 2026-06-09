/**
 * One-off backfill for the região hierarchy (run once after migrating to the
 * Polo.regiao / monitor-região model):
 *
 *   1. For each Polo without a região, infer it from the most common região of
 *      its OS' municípios (via resolveRegiao). Polos created automatically from
 *      the "unidade executante" import have no município, so any that can't be
 *      inferred are left null and must be set by an admin in the Usuários/Polo UI.
 *   2. Re-sync every OrdemServico.regiaoAdministrativa from its polo's região,
 *      since monitor scope and the dashboard read that denormalized column.
 *
 * Usage: tsx scripts/backfill-regioes.ts   (requires DATABASE_URL)
 */
import { PrismaClient } from "@prisma/client";
import { resolveRegiao } from "@/data/regioes-sp";

const prisma = new PrismaClient();

async function main() {
  const polos = await prisma.polo.findMany({ select: { id: true, nome: true, regiao: true } });
  let infereddos = 0;
  let resynced = 0;

  for (const polo of polos) {
    let regiao = polo.regiao;

    if (!regiao) {
      // Tally the região of each distinct município this polo's OS touch.
      const cidades = await prisma.ordemServico.findMany({
        where: { poloId: polo.id, cidade: { not: null } },
        select: { cidade: true },
        distinct: ["cidade"]
      });
      const tally = new Map<string, number>();
      for (const { cidade } of cidades) {
        const r = resolveRegiao(cidade);
        if (r) tally.set(r, (tally.get(r) ?? 0) + 1);
      }
      const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (best) {
        regiao = best;
        await prisma.polo.update({ where: { id: polo.id }, data: { regiao } });
        infereddos += 1;
        console.log(`Polo "${polo.nome}" → região inferida: ${regiao}`);
      } else {
        console.log(`Polo "${polo.nome}" → região não inferida (defina manualmente)`);
      }
    }

    if (regiao) {
      const { count } = await prisma.ordemServico.updateMany({
        where: { poloId: polo.id },
        data: { regiaoAdministrativa: regiao }
      });
      resynced += count;
    }
  }

  console.log(`Concluído. Polos com região inferida: ${infereddos}. OS re-sincronizadas: ${resynced}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
