import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CardCandidato } from "./CardCandidato";
import type { CandidatoApi } from "../../types/candidato";

const candidato: CandidatoApi = {
    id: 1,
    studyId: 3,
    name: "Ana Silva",
    age: 42,
    eligibilityStatus: "ELIGIBLE",
    consentStatus: "GRANTED",
};
afterEach(cleanup);

it.each([
    {
        cenario: "estudo fora do recrutamento",
        estudoEmRecrutamento: false,
        vagas: 2,
        elegibilidade: "ELIGIBLE" as const,
        consentimento: "GRANTED" as const,
        motivo: "A inclusão só é permitida com o estudo em recrutamento.",
    },
    {
        cenario: "sem vagas",
        estudoEmRecrutamento: true,
        vagas: 0,
        elegibilidade: "ELIGIBLE" as const,
        consentimento: "GRANTED" as const,
        motivo: "O estudo atingiu o limite de vagas disponíveis.",
    },
    {
        cenario: "avaliação pendente",
        estudoEmRecrutamento: true,
        vagas: 2,
        elegibilidade: "PENDING" as const,
        consentimento: "GRANTED" as const,
        motivo: "Exige candidato com elegibilidade aprovada (Elegível).",
    },
    {
        cenario: "consentimento pendente",
        estudoEmRecrutamento: true,
        vagas: 2,
        elegibilidade: "ELIGIBLE" as const,
        consentimento: "PENDING" as const,
        motivo: "Exige consentimento simulado aceito pelo candidato.",
    },
])(
    "mantém a inclusão bloqueada e explica $cenario",
    ({ estudoEmRecrutamento, vagas, elegibilidade, consentimento, motivo }) => {
        const incluir = vi.fn();
        render(
            <CardCandidato
                candidato={{
                    ...candidato,
                    eligibilityStatus: elegibilidade,
                    consentStatus: consentimento,
                }}
                jaIncluido={false}
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
    }
);

it("encaminha o candidato original nas três ações sem acrescentar dados de apresentação", () => {
    const avaliar = vi.fn(),
        consentir = vi.fn(),
        incluir = vi.fn();
    render(
        <CardCandidato
            candidato={candidato}
            jaIncluido={false}
            vagasDisponiveis={2}
            onSelecionarCandidato={avaliar}
            onAbrirConsentimento={consentir}
            onIncluirParticipante={incluir}
        />
    );
    for (const nome of ["Avaliar elegibilidade", "Consentimento simulado", "Incluir participante"])
        fireEvent.click(screen.getByRole("button", { name: `${nome}: Ana Silva` }));
    for (const callback of [avaliar, consentir, incluir])
        expect(callback.mock.calls[0][0]).toBe(candidato);
});

it("apresenta a inclusão concluída e não oferece nova inclusão", () => {
    render(<CardCandidato candidato={candidato} jaIncluido onIncluirParticipante={vi.fn()} />);
    expect(screen.getByText("Paciente Incluído")).toBeInTheDocument();
    expect(
        screen.queryByRole("button", { name: "Incluir participante: Ana Silva" })
    ).not.toBeInTheDocument();
});
