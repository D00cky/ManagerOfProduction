import bcrypt from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import type { Perfil } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Credentials = {
  login?: string | null;
  password?: string | null;
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
  perfil: Perfil;
  matricula: string;
  poloId: string | null;
  polosPermitidos: string[];
  regiao: string | null;
};

const demoPassword = process.env.DEMO_AUTH_PASSWORD ?? "senha123";
const demoPoloId = "demo-polo";

const demoUsers: AuthUser[] = [
  {
    id: "demo-supervisor",
    name: "Supervisor Teste",
    email: "supervisor@example.com",
    matricula: "S0001",
    perfil: "supervisor",
    poloId: null,
    polosPermitidos: [],
    regiao: null
  },
  {
    id: "demo-monitor",
    name: "Monitor Teste",
    email: "monitor@example.com",
    matricula: "M0001",
    perfil: "monitor",
    poloId: demoPoloId,
    polosPermitidos: [demoPoloId],
    regiao: "São Paulo"
  },
  {
    id: "demo-fiscal",
    name: "Fiscal Teste",
    email: "fiscal@example.com",
    matricula: "F0001",
    perfil: "fiscal",
    poloId: demoPoloId,
    polosPermitidos: [],
    regiao: null
  }
];

export async function authorizeCredentials(credentials: Credentials | undefined): Promise<AuthUser | null> {
  const login = credentials?.login?.trim();
  const password = credentials?.password ?? "";
  if (!login || !password) return null;

  const user = await prisma.user.findFirst({
    where: {
      status: "ativo",
      OR: [{ email: login.toLowerCase() }, { matricula: login }]
    },
    include: { acessosPolo: true }
  });
  if (user) {
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    // A monitor oversees a whole região; their manageable polos are all polos in
    // that região (used by team/polo management scoping), independent of any
    // explicit UserPoloAccess rows.
    let polosPermitidos = user.acessosPolo.map((access) => access.poloId);
    if (user.perfil === "monitor" && user.regiao) {
      const polosDaRegiao = await prisma.polo.findMany({
        where: { regiao: user.regiao },
        select: { id: true }
      });
      polosPermitidos = polosDaRegiao.map((polo) => polo.id);
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      perfil: user.perfil,
      matricula: user.matricula,
      poloId: user.poloId,
      polosPermitidos,
      regiao: user.regiao
    };
  }

  if (process.env.DEMO_AUTH_ENABLED !== "true" || password !== demoPassword) return null;
  const normalizedLogin = login.toLowerCase();
  const demoUser = demoUsers.find(
    (candidate) => candidate.email.toLowerCase() === normalizedLogin || candidate.matricula === login
  );
  if (!demoUser) return null;
  return ensureDemoUser(demoUser);
}

/**
 * Materialize a demo account (and the polo it references) as real database rows.
 *
 * Demo auth lets the sample accounts log in even when the user table was never
 * seeded, but anything they then persist — tabulações, assignments, activity
 * logs — points back at their id via a foreign key. Without a matching User row
 * those writes fail (e.g. `Tabulacao_fiscalId_fkey`). Upserting on login makes
 * the demo account a stable, FK-valid row while keeping it idempotent.
 */
async function ensureDemoUser(demoUser: AuthUser): Promise<AuthUser> {
  if (demoUser.poloId) {
    await prisma.polo.upsert({
      where: { id: demoUser.poloId },
      update: {},
      create: {
        id: demoUser.poloId,
        nome: "Polo Demo",
        codigo: demoUser.poloId,
        regiao: demoUser.regiao ?? "São Paulo"
      }
    });
  }
  await prisma.user.upsert({
    where: { id: demoUser.id },
    update: { status: "ativo" },
    create: {
      id: demoUser.id,
      name: demoUser.name,
      email: demoUser.email,
      matricula: demoUser.matricula,
      perfil: demoUser.perfil,
      poloId: demoUser.poloId,
      regiao: demoUser.regiao,
      passwordHash: bcrypt.hashSync(demoPassword, 10)
    }
  });
  return demoUser;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Matricula ou e-mail",
      credentials: {
        login: { label: "Matricula ou e-mail", type: "text" },
        password: { label: "Senha", type: "password" }
      },
      authorize: authorizeCredentials
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) Object.assign(token, user);
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: String(token.id),
        name: token.name,
        email: token.email,
        perfil: token.perfil,
        matricula: token.matricula,
        poloId: token.poloId,
        polosPermitidos: token.polosPermitidos,
        regiao: token.regiao
      };
      return session;
    }
  }
};
