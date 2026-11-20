import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CardCandidato } from "./CardCandidato";
import type { CandidatoApi } from "../../types/candidato";

const candidato: CandidatoApi = {
    id: 1,
    studyId: 3,
    userId: 10,
    name: "Ana Silva",
    age: 42,
    email: "ana@example.test",
    phone: "(83) 99999-0001",
    status: "GRANTED",
    eligibilityStatus: "ELIGIBLE",
    consentStatus: "GRANTED",
};

afterEach(cleanup);

it.each([
    {
        cenario: "estudo fora do recrutamento",
        estudoEmRecrutamento: false,
        vagas: 2,
        motivo: "A inclusão só é permitida com o estudo em recrutamento.",
    },
    {
        cenario: "sem vagas",
        estudoEmRecrutamento: true,
        vagas: 0,
        motivo: "O estudo atingiu o limite de vagas disponíveis.",
    },
    {
        cenario: "vagas ainda desconhecidas",
        estudoEmRecrutamento: true,
        vagas: undefined,
        motivo: "Consulte as vagas disponíveis antes de incluir o participante.",
    },
])("bloqueia a inclusão e explica $cenario", ({ estudoEmRecrutamento, vagas, motivo }) => {
    const incluir = vi.fn();
    render(
        <CardCandidato
            candidato={candidato}
            estudoEmRecrutamento={estudoEmRecrutamento}
            vagasDisponiveis={vagas}
            onIncluirParticipante={incluir}
        />
    );
    const botao = screen.getByRole("button", { name: "Incluir participante: Ana Silva" });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("title", motivo);
    fireEvent.click(botao);
    expect(incluir).not.toHaveBeenCalled();
});

it.each([
    { status: "INVITED", rotulo: "Convidado", avaliar: true, incluir: false, cancelar: true },
    { status: "ACTIVE", rotulo: "Conta ativa", avaliar: true, incluir: false, cancelar: true },
    {
        status: "CONSENT_PENDING",
        rotulo: "Aguardando decisão",
        avaliar: true,
        incluir: false,
        cancelar: true,
    },
    { status: "GRANTED", rotulo: "Aceitou", avaliar: true, incluir: true, cancelar: true },
    { status: "DECLINED", rotulo: "Recusou", avaliar: true, incluir: false, cancelar: true },
    { status: "INCLUDED", rotulo: "Incluído", avaliar: false, incluir: false, cancelar: false },
    { status: "CANCELLED", rotulo: "Cancelado", avaliar: false, incluir: false, cancelar: false },
] as const)(
    "respeita a situação $status retornada pela API",
    ({ status, rotulo, avaliar, incluir, cancelar }) => {
        render(
            <CardCandidato
                candidato={{ ...candidato, status }}
                estudoEmRecrutamento
                vagasDisponiveis={2}
                onSelecionarCandidato={vi.fn()}
                onIncluirParticipante={vi.fn()}
                onCancelarCandidatura={vi.fn()}
            />
        );
        expect(screen.getByText(rotulo)).toBeInTheDocument();
        expect(
            Boolean(screen.queryByRole("button", { name: "Avaliar elegibilidade: Ana Silva" }))
        ).toBe(avaliar);
        expect(
            Boolean(screen.queryByRole("button", { name: "Incluir participante: Ana Silva" }))
        ).toBe(incluir);
        expect(
            Boolean(screen.queryByRole("button", { name: "Cancelar candidatura: Ana Silva" }))
        ).toBe(cancelar);
        expect(screen.queryByRole("button", { name: /consentimento/i })).not.toBeInTheDocument();
    }
);

it.each([
    { eligibilityStatus: "PENDING", consentStatus: "GRANTED" },
    { eligibilityStatus: "INELIGIBLE", consentStatus: "GRANTED" },
    { eligibilityStatus: "ELIGIBLE", consentStatus: "PENDING" },
    { eligibilityStatus: "ELIGIBLE", consentStatus: "DECLINED" },
] as const)("não oferece inclusão sem as pré-condições do candidato (%s)", (condicoes) => {
    render(
        <CardCandidato
            candidato={{ ...candidato, ...condicoes }}
            estudoEmRecrutamento
            vagasDisponiveis={2}
            onIncluirParticipante={vi.fn()}
        />
    );
    expect(
        screen.queryByRole("button", { name: "Incluir participante: Ana Silva" })
    ).not.toBeInTheDocument();
});

it("encaminha o candidato original nas ações atuais, sem acrescentar dados de apresentação", () => {
    const avaliar = vi.fn(),
        incluir = vi.fn(),
        cancelar = vi.fn();
    render(
        <CardCandidato
            candidato={candidato}
            estudoEmRecrutamento
            vagasDisponiveis={2}
            onSelecionarCandidato={avaliar}
            onIncluirParticipante={incluir}
            onCancelarCandidatura={cancelar}
        />
    );
    for (const nome of ["Avaliar elegibilidade", "Incluir participante", "Cancelar candidatura"])
        fireEvent.click(screen.getByRole("button", { name: `${nome}: Ana Silva` }));
    for (const callback of [avaliar, incluir, cancelar])
        expect(callback.mock.calls[0][0]).toBe(candidato);
});

it("mantém a situação e a elegibilidade visíveis em modo de consulta", () => {
    render(<CardCandidato candidato={candidato} />);
    expect(screen.getByText("Aceitou")).toBeInTheDocument();
    expect(screen.getByText("Elegível")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("preserva a decisão final do candidato e o motivo do cancelamento", () => {
    const { rerender } = render(
        <CardCandidato
            candidato={{ ...candidato, status: "DECLINED", consentStatus: "DECLINED" }}
        />
    );
    expect(screen.getByText("Decisão final do candidato.")).toBeInTheDocument();
    rerender(
        <CardCandidato
            candidato={{
                ...candidato,
                status: "CANCELLED",
                cancellation: {
                    reason: "E-mail incorreto",
                    cancelledAt: "2026-11-19T12:00:00Z",
                    cancelledByUserId: 9,
                },
            }}
        />
    );
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
    expect(screen.getByText("Motivo: E-mail incorreto")).toBeInTheDocument();
});

it("não presume recrutamento quando o contexto do estudo não foi informado", () => {
    render(
        <CardCandidato
            candidato={candidato}
            vagasDisponiveis={2}
            onIncluirParticipante={vi.fn()}
            onCancelarCandidatura={vi.fn()}
        />
    );
    expect(screen.getByRole("button", { name: "Incluir participante: Ana Silva" })).toBeDisabled();
    expect(
        screen.queryByRole("button", { name: "Cancelar candidatura: Ana Silva" })
    ).not.toBeInTheDocument();
});
