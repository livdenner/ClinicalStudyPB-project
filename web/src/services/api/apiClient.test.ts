import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("cliente HTTP compartilhado", () => {
  it.each(["", "https://api.example.test/"])(
    "envia login ao caminho correto com base '%s'",
    async (baseUrl) => {
      vi.stubEnv("VITE_API_BASE_URL", baseUrl);
      vi.resetModules();
      const { apiRequest } = await import("./apiClient");
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "token" }), { status: 200 }),
      );

      await expect(
        apiRequest("/api/v1/auth/login", {
          method: "POST",
          body: { email: "teste@example.test", password: "senha" },
        }),
      ).resolves.toEqual({ accessToken: "token" });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(`${baseUrl.replace(/\/+$/, "")}/api/v1/auth/login`);
      expect(options?.body).toBe(
        JSON.stringify({ email: "teste@example.test", password: "senha" }),
      );
      expect(new Headers(options?.headers).get("Content-Type")).toBe(
        "application/json",
      );
    },
  );

  it("aceita logout 204 e envia o JWT", async () => {
    const { apiRequest } = await import("./apiClient");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );

    await expect(
      apiRequest<void>("/api/v1/auth/logout", { method: "POST", token: "jwt" }),
    ).resolves.toBeUndefined();
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"))
      .toBe("Bearer jwt");
  });

  it.each([
    [{ detail: "Estudo não encontrado." }, 404, "Estudo não encontrado."],
    [{ code: "INVALID_REQUEST", message: "Dados inválidos.",
      fieldErrors: [{ field: "email", message: "E-mail inválido." }] },
    400, "Dados inválidos."],
  ])("normaliza o erro do backend %j", async (body, status, message) => {
    const { apiRequest, ApiClientError } = await import("./apiClient");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/problem+json" },
      }),
    );

    const error = await apiRequest("/api/studies").catch((cause) => cause);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status, message });
    if ("fieldErrors" in body) {
      expect(error).toHaveProperty("fieldErrors", body.fieldErrors);
    }
  });
});
