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
  return (
    demoUsers.find(
      (demoUser) => demoUser.email.toLowerCase() === normalizedLogin || demoUser.matricula === login
    ) ?? null
  );
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
