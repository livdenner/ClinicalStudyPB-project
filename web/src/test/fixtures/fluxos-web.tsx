import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../context/AuthContext";
import { AUTH_STORAGE_KEY } from "../../services/auth";
import type { UserRole } from "../../types/auth";
import type { CadastroCandidatoApi, CandidatoApi } from "../../types/candidato";
import type { ResultadosVisita } from "../../types/resultado-atividade";
import { estudoAgendamento, visitaAgendada } from "./agendamento";

/** Fixtures fictícias compartilhadas pelas T17.8, T19.4 e T20.5. @author Lívia */
export const candidatoFluxo = {
    id: 101,
    studyId: 10,
    userId: 201,
    name: "Pessoa fictícia",
    email: "pessoa@example.test",
    phone: "(83) 99999-0000",
    age: 42,
    status: "CONSENT_PENDING",
    eligibilityStatus: "ELIGIBLE",
    consentStatus: "PENDING",
} satisfies CandidatoApi;

export const cadastroConvidado = {
    ...candidatoFluxo,
    status: "INVITED",
    eligibilityStatus: "PENDING",
    activation: { activationCode: "DEMO-1234", expiresAt: "2027-02-10T12:00:00Z", expired: false },
} satisfies CadastroCandidatoApi;

export const cadastroAtivo = {
    ...candidatoFluxo,
    status: "ACTIVE",
    eligibilityStatus: "PENDING",
} satisfies CadastroCandidatoApi;

export const resultadosFluxo: ResultadosVisita = {
    visitId: visitaAgendada.id,
    plannedVisitId: visitaAgendada.plannedVisitId,
    plannedVisitName: visitaAgendada.plannedVisitName,
    status: "DONE",
    activities: [
        {
            activityId: 12,
            name: "Segunda atividade fictícia",
            description: "Demonstração B",
            position: 2,
        },
        {
            activityId: 11,
            name: "Primeira atividade fictícia",
            description: "Demonstração A",
            position: 1,
        },
    ],
};

/** A autenticação é local e fictícia; as chamadas HTTP são simuladas em cada teste. @author Lívia */
export function renderFluxo(elemento: ReactElement, role: UserRole = "COORDINATOR", path = "/") {
    sessionStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
            accessToken: "token-ficticio",
            tokenType: "Bearer",
            expiresAt: Date.now() + 3_600_000,
            user: {
                id: role === "RESEARCHER" ? estudoAgendamento.responsibleUserId : 9,
                name: "Equipe fictícia",
                email: "equipe@example.test",
                role,
                active: true,
            },
        })
    );
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={[path]}>{elemento}</MemoryRouter>
        </AuthProvider>
    );
}

/** Promessa controlada para observar a interface durante uma gravação, sem esperas fixas. @author Lívia */
export function promessaControlada<T>() {
    let resolver!: (valor: T) => void;
    const promessa = new Promise<T>((resolve) => {
        resolver = resolve;
    });
    return { promessa, resolver };
}
