import bcrypt from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";

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
      async authorize(credentials) {
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
        if (!user) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          perfil: user.perfil,
          matricula: user.matricula,
          poloId: user.poloId,
          polosPermitidos: user.acessosPolo.map((access) => access.poloId)
        };
      }
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
        polosPermitidos: token.polosPermitidos
      };
      return session;
    }
  }
};
