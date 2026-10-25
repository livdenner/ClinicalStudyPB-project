import type { UserRole } from "./auth";

export type FiltroSituacaoUsuario = "" | "ativo" | "inativo";

export type Usuario = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
};

export type DadosEdicaoUsuario = Pick<Usuario, "name" | "email" | "role">;

export type DadosCadastroUsuario = DadosEdicaoUsuario & {
  password: string;
};
