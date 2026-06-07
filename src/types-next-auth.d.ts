import type { Perfil } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      perfil: Perfil;
      matricula: string;
      poloId?: string | null;
      polosPermitidos?: string[];
    };
  }

  interface User {
    perfil: Perfil;
    matricula: string;
    poloId?: string | null;
    polosPermitidos?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    perfil: Perfil;
    matricula: string;
    poloId?: string | null;
    polosPermitidos?: string[];
  }
}
