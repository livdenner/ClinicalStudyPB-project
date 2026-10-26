import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "./api/apiClient";
import { cadastrarEstudo, editarEstudo, listarEstudos, obterEstudo } from "./estudos";
import type { DadosEstudoApi, EstudoApi } from "../types/estudo";

const dados: DadosEstudoApi = {
  title: "Estudo do sono",
  objective: "Avaliar hábitos de sono",
  responsibleUserId: 7,
  startDate: "2026-11-01",
  endDate: "2026-12-01",
  participantLimit: 30,
};
const estudo: EstudoApi = { id: 3, ...dados };

function resposta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => vi.restoreAllMocks());

describe("integração HTTP de estudos", () => {
  it("consulta um estudo pelo ID com JWT e sinal de cancelamento", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resposta(estudo));
    const controller = new AbortController();

    await expect(obterEstudo(3, "jwt", controller.signal)).resolves.toEqual(estudo);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/studies/3");
    expect(options?.signal).toBe(controller.signal);
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer jwt");
  });

  it("lista os dados reais com JWT e sinal de cancelamento", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resposta([estudo]));
    const controller = new AbortController();

    await expect(listarEstudos("jwt", controller.signal)).resolves.toEqual([estudo]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/studies");
    expect(options?.signal).toBe(controller.signal);
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer jwt");
  });

  it.each(["cadastro", "edição"])("envia somente o contrato implementado no %s", async (acao) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resposta(estudo, acao === "cadastro" ? 201 : 200));
    const resultado = acao === "cadastro"
      ? await cadastrarEstudo(dados, "jwt")
      : await editarEstudo(3, dados, "jwt");

    expect(resultado).toEqual(estudo);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(acao === "cadastro" ? "/api/studies" : "/api/studies/3");
    expect(options?.method).toBe(acao === "cadastro" ? "POST" : "PUT");
    expect(JSON.parse(String(options?.body))).toEqual(dados);
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer jwt");
  });

  it("preserva a regra de negócio retornada pelo backend", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resposta({
      detail: "O pesquisador responsável pelo estudo deve estar ativo.",
    }, 400));

    await expect(cadastrarEstudo(dados, "jwt")).rejects.toMatchObject({
      status: 400,
      message: "O pesquisador responsável pelo estudo deve estar ativo.",
    });
  });

  it("propaga a falta de permissão sem usar dados mock", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resposta({ detail: "Acesso negado." }, 403));
    await expect(listarEstudos("jwt")).rejects.toBeInstanceOf(ApiClientError);
  });
});
