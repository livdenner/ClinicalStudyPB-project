import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalUsuario } from "./ModalUsuario";
import { ApiClientError } from "../../services/api/apiClient";
import type { Usuario } from "../../types/usuario";

const usuario: Usuario = {
  id: 2, name: "Ana Silva", email: "ana@example.test", role: "RESEARCHER", active: true,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function preencherCadastro() {
  const dialog = await screen.findByRole("dialog", { name: "Novo usuário" });
  fireEvent.change(within(dialog).getByLabelText(/^Nome/), { target: { value: " Maria Silva " } });
  fireEvent.change(within(dialog).getByLabelText(/^E-mail/), { target: { value: "maria@example.test" } });
  fireEvent.change(within(dialog).getByLabelText(/^Senha/), { target: { value: "SenhaTeste123" } });
  return dialog;
}

describe("ModalUsuario", () => {
  it("bloqueia o cadastro quando os campos obrigatórios estão vazios", async () => {
    const onSalvar = vi.fn().mockResolvedValue(undefined);
    render(<ModalUsuario onFechar={vi.fn()} onSalvar={onSalvar} />);
    const dialog = await screen.findByRole("dialog", { name: "Novo usuário" });
    for (const rotulo of [/^Nome/, /^E-mail/, /^Senha/]) {
      expect(within(dialog).getByLabelText(rotulo)).toBeRequired();
      expect(within(dialog).getByLabelText(rotulo)).toBeInvalid();
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar usuário" }));
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it("rejeita nome e senha formados apenas por espaços", async () => {
    const onSalvar = vi.fn().mockResolvedValue(undefined);
    render(<ModalUsuario onFechar={vi.fn()} onSalvar={onSalvar} />);
    const dialog = await preencherCadastro();
    fireEvent.change(within(dialog).getByLabelText(/^Nome/), { target: { value: "   " } });
    fireEvent.change(within(dialog).getByLabelText(/^Senha/), { target: { value: "   " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar usuário" }));
    expect(await screen.findByText("Informe o nome do usuário.")).toBeInTheDocument();
    expect(screen.getByText("Informe uma senha.")).toBeInTheDocument();
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it("mostra e oculta a senha sem alterar o valor digitado", async () => {
    render(<ModalUsuario onFechar={vi.fn()} onSalvar={vi.fn().mockResolvedValue(undefined)} />);
    const dialog = await preencherCadastro();
    const senha = within(dialog).getByLabelText(/^Senha/);
    expect(senha).toHaveAttribute("type", "password");
    fireEvent.click(within(dialog).getByRole("button", { name: "Mostrar senha" }));
    expect(senha).toHaveAttribute("type", "text");
    expect(senha).toHaveValue("SenhaTeste123");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ocultar senha" }));
    expect(senha).toHaveAttribute("type", "password");
    expect(senha).toHaveValue("SenhaTeste123");
  });

  it("envia o perfil selecionado e o nome sem espaços ao cadastrar", async () => {
    const onSalvar = vi.fn().mockResolvedValue(undefined);
    render(<ModalUsuario onFechar={vi.fn()} onSalvar={onSalvar} />);
    const dialog = await preencherCadastro();
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Perfil/ }));
    fireEvent.click(await screen.findByRole("option", { name: "Coordenador" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar usuário" }));
    await waitFor(() => expect(onSalvar).toHaveBeenCalledWith({
      name: "Maria Silva", email: "maria@example.test", role: "COORDINATOR", password: "SenhaTeste123",
    }, undefined));
  });

  it("preenche a edição sem oferecer alteração de senha", async () => {
    render(<ModalUsuario usuario={usuario} onFechar={vi.fn()} onSalvar={vi.fn().mockResolvedValue(undefined)} />);
    const dialog = await screen.findByRole("dialog", { name: "Editar usuário" });
    expect(within(dialog).getByLabelText(/^Nome/)).toHaveValue(usuario.name);
    expect(within(dialog).getByLabelText(/^E-mail/)).toHaveValue(usuario.email);
    expect(within(dialog).getByRole("button", { name: /Perfil/ })).toHaveTextContent("Pesquisador");
    expect(within(dialog).getByRole("switch")).toBeChecked();
    expect(within(dialog).queryByLabelText(/^Senha/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Mostrar senha" })).not.toBeInTheDocument();
  });

  it.each(["Cancelar", "Fechar modal"])("chama onFechar ao acionar %s sem salvar", async (botao) => {
    const onFechar = vi.fn();
    const onSalvar = vi.fn().mockResolvedValue(undefined);
    render(<ModalUsuario onFechar={onFechar} onSalvar={onSalvar} />);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: botao }));
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it("bloqueia os controles e impede envios repetidos durante o cadastro", async () => {
    let concluir!: () => void;
    const pendente = new Promise<void>((resolve) => { concluir = resolve; });
    const onSalvar = vi.fn().mockReturnValue(pendente);
    const onFechar = vi.fn();
    render(<ModalUsuario onFechar={onFechar} onSalvar={onSalvar} />);
    const dialog = await preencherCadastro();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar usuário" }));
    for (const rotulo of [/^Nome/, /^E-mail/, /^Senha/]) {
      expect(within(dialog).getByLabelText(rotulo)).toBeDisabled();
    }
    expect(within(dialog).getByRole("button", { name: /Perfil/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Fechar modal" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    const salvar = within(dialog).getByRole("button", { name: "Salvando..." });
    expect(salvar).toBeDisabled();
    fireEvent.click(salvar);
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(onSalvar).toHaveBeenCalledTimes(1);
    expect(onFechar).not.toHaveBeenCalled();
    await act(async () => concluir());
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cadastrar usuário" })).toBeEnabled());
  });

  it("informa sessão expirada e mantém os dados para nova tentativa", async () => {
    const onSalvar = vi.fn().mockRejectedValue(new ApiClientError("Unauthorized", { status: 401 }));
    render(<ModalUsuario usuario={usuario} onFechar={vi.fn()} onSalvar={onSalvar} />);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sua sessão expirou. Entre novamente para salvar.");
    expect(within(dialog).getByLabelText(/^Nome/)).toHaveValue(usuario.name);
    expect(within(dialog).getByRole("button", { name: "Salvar alterações" })).toBeEnabled();
  });
});
