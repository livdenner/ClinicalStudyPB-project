import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabelaUsuarios } from "./TabelaUsuarios";
import type { Usuario } from "../../types/usuario";

const usuarios: Usuario[] = [
  {
    id: 1,
    name: "Livia",
    email: "livia@example.test",
    role: "ADMINISTRATOR",
    active: true,
  },
  {
    id: 2,
    name: "Lucas",
    email: "lucas@example.test",
    role: "COORDINATOR",
    active: false,
  },
  {
    id: 3,
    name: "Julio",
    email: "julio@example.test",
    role: "RESEARCHER",
    active: true,
  },
  {
    id: 4,
    name: "Allan",
    email: "allan@example.test",
    role: "PARTICIPANT",
    active: false,
  },
];

afterEach(cleanup);

describe("TabelaUsuarios", () => {
  it("exibe identificação, perfil e situação de cada usuário", () => {
    render(<TabelaUsuarios usuarios={usuarios} onEditar={vi.fn()} />);
    const tabela = screen.getByRole("grid", { name: "Lista de usuários" });
    const perfis = [
      "Administrador",
      "Coordenador",
      "Pesquisador",
      "Participante",
    ];
    for (const [indice, usuario] of usuarios.entries()) {
      const linha = within(tabela)
        .getByRole("rowheader", { name: usuario.name })
        .closest("tr")!;
      expect(within(linha).getByText(usuario.email)).toBeInTheDocument();
      expect(within(linha).getByText(perfis[indice])).toBeInTheDocument();
      expect(
        within(linha).getByText(usuario.active ? "Ativo" : "Inativo"),
      ).toBeInTheDocument();
    }
  });

  it("envia ao callback o usuário correspondente ao botão de edição", () => {
    const onEditar = vi.fn();
    render(<TabelaUsuarios usuarios={usuarios} onEditar={onEditar} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Editar usuário: Julio" }),
    );
    expect(onEditar).toHaveBeenCalledTimes(1);
    expect(onEditar).toHaveBeenCalledWith(usuarios[2]);
  });

  it("exibe orientação quando não existem resultados", () => {
    render(<TabelaUsuarios usuarios={[]} onEditar={vi.fn()} />);
    expect(screen.getByText("Nenhum usuário encontrado")).toBeInTheDocument();
    expect(
      screen.getByText("Ajuste os filtros ou cadastre um novo usuário."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Editar usuário:/ }),
    ).not.toBeInTheDocument();
  });
});
