import bcrypt from "bcryptjs";

/** Credencial mínima para verificar a senha atual de um usuário ativo. */
export type CredencialUsuario = { id: string; passwordHash: string };

export type SenhaRepository = {
  /** Busca a credencial de um usuário ativo por e-mail ou matrícula. */
  findCredencialPorLogin(login: string): Promise<CredencialUsuario | null>;
  /** Persiste a nova senha (o repositório é quem aplica o hash). */
  atualizarSenha(id: string, novaSenha: string): Promise<void>;
};

export type AlterarSenhaInput = {
  login: string;
  senhaAtual: string;
  novaSenha: string;
};

export const SENHA_MIN_LENGTH = 6;

/**
 * Troca a senha do próprio usuário a partir da tela de login (sem sessão).
 *
 * Exige a senha atual: o fluxo equivale a um login, então é seguro expô-lo sem
 * autenticação. Erros de identificação retornam uma mensagem genérica para não
 * revelar se o login existe ou qual campo falhou.
 */
export async function alterarSenhaPropria(
  repository: SenhaRepository,
  input: AlterarSenhaInput
): Promise<void> {
  const login = input.login?.trim() ?? "";
  const senhaAtual = input.senhaAtual ?? "";
  const novaSenha = input.novaSenha ?? "";

  if (!login || !senhaAtual) throw new Error("Informe o login e a senha atual");
  if (novaSenha.length < SENHA_MIN_LENGTH) {
    throw new Error(`A nova senha deve ter ao menos ${SENHA_MIN_LENGTH} caracteres`);
  }
  if (novaSenha === senhaAtual) throw new Error("A nova senha deve ser diferente da atual");

  const credencial = await repository.findCredencialPorLogin(login);
  if (!credencial || !(await bcrypt.compare(senhaAtual, credencial.passwordHash))) {
    throw new Error("Login ou senha atual invalidos");
  }

  await repository.atualizarSenha(credencial.id, novaSenha);
}
