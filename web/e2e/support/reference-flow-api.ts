import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";
import { accounts, DEMO_PASSWORD } from "./auth";

/**
 * Prepara pela API o ponto de partida do fluxo de referência (T19.5): um estudo em
 * recrutamento, com protocolo completo, e um candidato elegível que já aceitou o termo.
 *
 * Fica separado do E2E do PBI-17 (full-recruitment.spec.ts): aqui o recrutamento é só
 * pré-condição, e cada execução cria dados fictícios novos, sem tocar nos da seed.
 * As chamadas passam pelo proxy /api do `vite preview` (baseURL do Playwright).
 */

export const VISIT_NAME = "Avaliação inicial";
const CANDIDATE_PASSWORD = "FluxoReferencia2026";

export type RecruitingStudy = {
    studyId: number;
    studyTitle: string;
    candidateId: number;
    candidateName: string;
    plannedVisitId: number;
};

type Session = { accessToken: string; user: { id: number } };

function bearer(token: string) {
    return { Authorization: `Bearer ${token}` };
}

async function json<T>(response: APIResponse, expected: number, step: string): Promise<T> {
    expect(response.status(), `${step}: ${await response.text()}`).toBe(expected);
    return (await response.json()) as T;
}

async function login(request: APIRequestContext, email: string, password = DEMO_PASSWORD) {
    const response = await request.post("/api/auth/login", { data: { email, password } });
    return json<Session>(response, 200, `login de ${email}`);
}

/** Dados fictícios e únicos por execução: o banco da stack é compartilhado pelos testes. */
export function uniqueSuffix() {
    return `${Date.now()}-${Math.floor(Math.random() * 1_000)}`;
}

export async function coordinatorToken(request: APIRequestContext) {
    return (await login(request, accounts.coordinator)).accessToken;
}

/**
 * Pesquisador: estudo com critérios e visita prevista, recrutamento aberto.
 * Coordenador: candidato com e-mail novo e elegibilidade ELIGIBLE.
 * Candidato: ativa a conta com o código do cadastro e aceita o termo (GRANTED).
 */
export async function createRecruitingStudyWithGrantedCandidate(
    request: APIRequestContext,
    scenario: string
): Promise<RecruitingStudy> {
    const suffix = uniqueSuffix();
    const studyTitle = `Estudo E2E fluxo de referência ${scenario} ${suffix}`;
    const candidateName = `Participante E2E ${scenario} ${suffix}`;
    const email = `fluxo.referencia.${scenario}.${suffix}@exemplo.test`;

    const researcher = await login(request, accounts.researcher);
    const asResearcher = { headers: bearer(researcher.accessToken) };
    const study = await json<{ id: number }>(
        await request.post("/api/studies", {
            ...asResearcher,
            data: {
                title: studyTitle,
                objective: "Demonstrar inclusão, agendamento e desfecho de visita.",
                responsibleUserId: researcher.user.id,
                startDate: "2027-02-01",
                endDate: "2027-07-31",
                participantLimit: 5,
            },
        }),
        201,
        "cadastro do estudo"
    );
    const criteria: { id: number; type: string }[] = [];
    for (const [type, description] of [
        ["INCLUSION", "Ter 18 anos ou mais"],
        ["EXCLUSION", "Estar em gestação"],
    ]) {
        criteria.push(
            await json<{ id: number; type: string }>(
                await request.post(`/api/studies/${study.id}/criteria`, {
                    ...asResearcher,
                    data: { type, description },
                }),
                201,
                `critério ${type}`
            )
        );
    }
    // A visita prevista altera o protocolo: a API exige a versão atual do estudo (If-Match).
    const current = await json<{ version: number }>(
        await request.get(`/api/studies/${study.id}`, asResearcher),
        200,
        "consulta da versão do estudo"
    );
    const plannedVisit = await json<{ id: number }>(
        await request.post(`/api/studies/${study.id}/planned-visits`, {
            headers: { ...asResearcher.headers, "If-Match": `"${current.version}"` },
            data: {
                name: VISIT_NAME,
                plannedDate: "2027-02-15",
                activities: [
                    {
                        name: "Entrevista clínica",
                        description: "Histórico de saúde e medicamentos em uso",
                    },
                ],
            },
        }),
        201,
        "visita prevista"
    );
    await json(
        await request.patch(`/api/studies/${study.id}/status`, {
            ...asResearcher,
            data: { status: "RECRUITMENT", expectedStatus: "PLANNING" },
        }),
        200,
        "abertura do recrutamento"
    );

    const coordinator = await coordinatorToken(request);
    const asCoordinator = { headers: bearer(coordinator) };
    const candidate = await json<{ id: number; activation: { activationCode: string } }>(
        await request.post(`/api/studies/${study.id}/candidates`, {
            ...asCoordinator,
            data: { name: candidateName, age: 41, email, phone: "(83) 99999-0000" },
        }),
        201,
        "cadastro do candidato"
    );
    await json(
        await request.put(`/api/studies/${study.id}/candidates/${candidate.id}/eligibility`, {
            ...asCoordinator,
            data: {
                answers: criteria.map((criterion) => ({
                    criterionId: criterion.id,
                    matches: criterion.type === "INCLUSION",
                })),
            },
        }),
        200,
        "avaliação de elegibilidade"
    );

    const restricted = await json<Session>(
        await request.post("/api/auth/activation", {
            data: { email, activationCode: candidate.activation.activationCode },
        }),
        200,
        "ativação da conta"
    );
    const session = await json<Session>(
        await request.put("/api/auth/password", {
            headers: bearer(restricted.accessToken),
            data: { newPassword: CANDIDATE_PASSWORD },
        }),
        200,
        "definição da senha"
    );
    await json(
        await request.post(`/api/me/invitations/${candidate.id}/decision`, {
            headers: bearer(session.accessToken),
            data: { status: "GRANTED" },
        }),
        200,
        "aceite do termo"
    );

    return {
        studyId: study.id,
        studyTitle,
        candidateId: candidate.id,
        candidateName,
        plannedVisitId: plannedVisit.id,
    };
}

/** Inclui pela API e agenda a visita prevista, para o cenário de agendamento duplicado. */
export async function includeAndSchedule(
    request: APIRequestContext,
    study: RecruitingStudy,
    scheduledAt: string
) {
    const headers = bearer(await coordinatorToken(request));
    const participant = await json<{ id: number }>(
        await request.post(
            `/api/studies/${study.studyId}/candidates/${study.candidateId}/inclusion`,
            { headers }
        ),
        201,
        "inclusão do participante"
    );
    await json(
        await request.post(`/api/studies/${study.studyId}/participants/${participant.id}/visits`, {
            headers,
            data: { plannedVisitId: study.plannedVisitId, scheduledAt },
        }),
        201,
        "primeiro agendamento"
    );
    return participant.id;
}

/** Visitas agendadas do participante, lidas direto da API. */
export async function scheduledVisits(
    request: APIRequestContext,
    studyId: number,
    participantId: number
) {
    const response = await request.get(
        `/api/studies/${studyId}/participants/${participantId}/visits`,
        { headers: bearer(await coordinatorToken(request)) }
    );
    return json<{ id: number; status: string; plannedVisitName: string }[]>(
        response,
        200,
        "consulta das visitas"
    );
}
