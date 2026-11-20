import { expect, type APIRequestContext } from "@playwright/test";

/**
 * Ações do candidato e do coordenador feitas direto na API da stack de teste
 * (compose.e2e.yaml), sem e-mail real: o código de ativação vem da resposta do cadastro,
 * a mesma que a tela do coordenador exibe como recurso de demonstração.
 *
 * As chamadas passam pelo proxy /api do `vite preview` (baseURL do Playwright).
 */

/** Senha fictícia definida no primeiro acesso; segue a política (letra e número, 8 a 72). */
export const CANDIDATE_PASSWORD = "CandidataE2E2026";

export type ConsentDecision = "GRANTED" | "DECLINED";

type Session = {
    accessToken: string;
    user: { role: string; mustChangePassword?: boolean };
};

function bearer(token: string) {
    return { Authorization: `Bearer ${token}` };
}

/** Entra pela API e devolve o token de acesso. */
export async function loginByApi(
    request: APIRequestContext,
    email: string,
    password: string
): Promise<string> {
    const response = await request.post("/api/auth/login", { data: { email, password } });
    expect(response.status(), "login pela API").toBe(200);
    return ((await response.json()) as Session).accessToken;
}

/**
 * Primeiro acesso do candidato: ativa a conta com o código (sessão restrita) e define a
 * senha, que devolve a sessão sem restrição usada nas chamadas seguintes.
 */
export async function activateCandidate(
    request: APIRequestContext,
    email: string,
    activationCode: string
): Promise<string> {
    const activation = await request.post("/api/auth/activation", {
        data: { email, activationCode },
    });
    expect(activation.status(), "ativação da conta").toBe(200);
    const restricted = (await activation.json()) as Session;
    expect(restricted.user.role).toBe("PARTICIPANT");
    expect(restricted.user.mustChangePassword).toBe(true);

    const password = await request.put("/api/auth/password", {
        headers: bearer(restricted.accessToken),
        data: { newPassword: CANDIDATE_PASSWORD },
    });
    expect(password.status(), "definição da senha").toBe(200);
    const session = (await password.json()) as Session;
    expect(session.user.mustChangePassword).toBe(false);
    return session.accessToken;
}

/** O candidato encontra o convite pendente e registra a decisão do termo simulado. */
export async function decideConsent(
    request: APIRequestContext,
    candidateToken: string,
    candidateId: number,
    status: ConsentDecision
) {
    const pending = await request.get("/api/me/invitations?status=CONSENT_PENDING", {
        headers: bearer(candidateToken),
    });
    expect(pending.status(), "consulta dos convites pendentes").toBe(200);
    const invitations = (await pending.json()) as { candidateId: number }[];
    expect(invitations.map((invitation) => invitation.candidateId)).toContain(candidateId);

    const decision = await request.post(`/api/me/invitations/${candidateId}/decision`, {
        headers: bearer(candidateToken),
        data: { status },
    });
    expect(decision.status(), `decisão ${status}`).toBe(200);
}

/** Repete a decisão para conferir que a primeira é definitiva. */
export async function expectDecisionIsFinal(
    request: APIRequestContext,
    candidateToken: string,
    candidateId: number,
    status: ConsentDecision
) {
    const response = await request.post(`/api/me/invitations/${candidateId}/decision`, {
        headers: bearer(candidateToken),
        data: { status },
    });
    expect(response.status()).toBe(409);
    expect(((await response.json()) as { code?: string }).code).toBe("CONSENT_ALREADY_DECIDED");
}

/** Tenta incluir pela API, como faria um cliente que ignorasse o bloqueio da tela. */
export async function expectInclusionRejected(
    request: APIRequestContext,
    coordinatorToken: string,
    studyId: number,
    candidateId: number
) {
    const inclusion = await request.post(
        `/api/studies/${studyId}/candidates/${candidateId}/inclusion`,
        { headers: bearer(coordinatorToken) }
    );
    expect(inclusion.status(), "inclusão de candidato que recusou").toBe(409);

    const participants = await request.get(`/api/studies/${studyId}/participants`, {
        headers: bearer(coordinatorToken),
    });
    expect(participants.status()).toBe(200);
    expect(await participants.json()).toEqual([]);
}
