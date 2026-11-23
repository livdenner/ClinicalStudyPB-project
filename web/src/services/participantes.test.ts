import { afterEach, expect, it, vi } from "vitest";
import { registrarRetiradaParticipante } from "./participantes";
import type { ApiClientError } from "./api/apiClient";

afterEach(() => vi.restoreAllMocks());

it("registra a retirada no participante e estudo corretos com motivo e JWT", async () => {
    const participante = {
        id: 7,
        studyId: 3,
        status: "WITHDRAWN",
        withdrawal: { reason: "Desistência", cancelledVisitCount: 2 },
    };
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify(participante)));
    await expect(registrarRetiradaParticipante(3, 7, "Desistência", "jwt")).resolves.toEqual(
        participante
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/studies/3/participants/7/withdrawal");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({ reason: "Desistência" });
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer jwt");
});

it("preserva o erro de conflito retornado pelo backend", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
            JSON.stringify({
                code: "PARTICIPANT_ALREADY_WITHDRAWN",
                detail: "O participante já foi retirado do estudo.",
            }),
            { status: 409 }
        )
    );
    await expect(registrarRetiradaParticipante(3, 7, "Desistência", "jwt")).rejects.toMatchObject({
        status: 409,
        code: "PARTICIPANT_ALREADY_WITHDRAWN",
        message: "O participante já foi retirado do estudo.",
    } satisfies Partial<ApiClientError>);
});
