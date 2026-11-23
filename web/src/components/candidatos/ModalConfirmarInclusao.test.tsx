import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../services/api/apiClient";
import type { CandidatoApi } from "../../types/candidato";
import { ModalConfirmarInclusao } from "./ModalConfirmarInclusao";

const candidato: CandidatoApi = {
    id: 102,
    studyId: 10,
    name: "Candidato 021",
    age: 55,
    email: "candidato021@exemplo.test",
    phone: "(83) 99999-0021",
    userId: 202,
    status: "GRANTED",
    eligibilityStatus: "ELIGIBLE",
    consentStatus: "GRANTED",
};

function renderModal(onConfirmar: () => Promise<void>) {
    const onFechar = vi.fn();
    render(
        <ModalConfirmarInclusao
            estudoTitulo="Estudo Cardiovascular Fase II"
            candidato={candidato}
            vagasOcupadas={2}
            limiteVagas={3}
            onFechar={onFechar}
            onConfirmar={onConfirmar}
        />
    );
    return {
        onFechar,
        dialog: screen.getByRole("dialog", { name: "Confirmar inclusão de participante" }),
    };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Confirmação de inclusão (RF11)", () => {
    it.each([
        { consentStatus: "PENDING", eligibilityStatus: "ELIGIBLE", vagas: 0, limite: 3 },
        { consentStatus: "DECLINED", eligibilityStatus: "ELIGIBLE", vagas: 0, limite: 3 },
        { consentStatus: "GRANTED", eligibilityStatus: "PENDING", vagas: 0, limite: 3 },
        { consentStatus: "GRANTED", eligibilityStatus: "INELIGIBLE", vagas: 0, limite: 3 },
        { consentStatus: "GRANTED", eligibilityStatus: "ELIGIBLE", vagas: 3, limite: 3 },
    ] as const)(
        "RF11-IN01: confirmação bloqueada sem aceite, elegibilidade ou vaga (%s)",
        ({ consentStatus, eligibilityStatus, vagas, limite }) => {
            const onConfirmar = vi.fn();
            render(
                <ModalConfirmarInclusao
                    estudoTitulo="Estudo fictício"
                    candidato={{ ...candidato, consentStatus, eligibilityStatus }}
                    vagasOcupadas={vagas}
                    limiteVagas={limite}
                    onFechar={vi.fn()}
                    onConfirmar={onConfirmar}
                />
            );
            const button = screen.getByRole("button", { name: "Confirmar inclusão" });
            expect(button).toBeDisabled();
            fireEvent.click(button);
            expect(onConfirmar).not.toHaveBeenCalled();
        }
    );

    it("mostra o candidato, o estudo e as vagas que restam", () => {
        const { dialog } = renderModal(vi.fn().mockResolvedValue(undefined));

        expect(within(dialog).getByText("Estudo Cardiovascular Fase II")).toBeInTheDocument();
        expect(within(dialog).getByText("Candidato 021")).toBeInTheDocument();
        expect(within(dialog).getByText("1 de 3")).toBeInTheDocument();
    });

    it("confirma uma única vez mesmo com cliques repetidos", async () => {
        let concluir!: () => void;
        const onConfirmar = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    concluir = resolve;
                })
        );
        const { dialog } = renderModal(onConfirmar);

        const confirmar = within(dialog).getByRole("button", { name: "Confirmar inclusão" });
        fireEvent.click(confirmar);
        fireEvent.click(confirmar);

        expect(onConfirmar).toHaveBeenCalledTimes(1);
        await act(async () => concluir());
        expect(confirmar).toBeEnabled();
    });

    it.each([
        [
            "o motivo do 409",
            new ApiClientError("O estudo atingiu o limite de participantes.", { status: 409 }),
            "O estudo atingiu o limite de participantes.",
        ],
        [
            "a falta de permissão",
            new ApiClientError("Proibido", { status: 403 }),
            "Você não tem permissão para incluir participantes neste estudo.",
        ],
        [
            "a sessão expirada",
            new ApiClientError("Não autenticado", { status: 401 }),
            "Sua sessão expirou. Entre novamente para incluir o participante.",
        ],
        [
            "o recurso não encontrado",
            new ApiClientError("Não encontrado", { status: 404 }),
            "Estudo ou candidato não encontrado para realizar a inclusão.",
        ],
        [
            "a falha de conexão",
            new TypeError("Failed to fetch"),
            "Não foi possível concluir a inclusão do participante. Tente novamente.",
        ],
    ])("mantém o modal aberto e mostra %s", async (_caso, erro, mensagem) => {
        const { dialog, onFechar } = renderModal(vi.fn().mockRejectedValue(erro));

        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar inclusão" }));

        expect(await within(dialog).findByText(mensagem)).toBeInTheDocument();
        expect(onFechar).not.toHaveBeenCalled();
        expect(within(dialog).getByRole("button", { name: "Confirmar inclusão" })).toBeEnabled();
    });

    it("fecha sem incluir ao cancelar", () => {
        const onConfirmar = vi.fn();
        const { dialog, onFechar } = renderModal(onConfirmar);

        fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

        expect(onFechar).toHaveBeenCalledTimes(1);
        expect(onConfirmar).not.toHaveBeenCalled();
    });
});
