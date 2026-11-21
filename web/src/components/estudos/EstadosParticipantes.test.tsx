import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { ParticipanteApi } from "../../types/participante";
import { CardsParticipantes } from "./CardsParticipantes";
import { TabelaParticipantes } from "./TabelaParticipantes";

afterEach(cleanup);

it.each([
    { tela: "desktop", status: "ACTIVE", rotulo: "Ativo", tom: "info" },
    { tela: "desktop", status: "WITHDRAWN", rotulo: "Retirado", tom: "neutral" },
    { tela: "celular", status: "ACTIVE", rotulo: "Ativo", tom: "info" },
    { tela: "celular", status: "WITHDRAWN", rotulo: "Retirado", tom: "neutral" },
] as const)(
    "T24.5 — Estados dos participantes: $status mantém sua cor e texto no $tela",
    ({ tela, status, rotulo, tom }) => {
        const participantes: ParticipanteApi[] = [
            {
                id: 1,
                studyId: 3,
                candidateId: 10,
                candidateName: "Ana Silva",
                includedAt: "2026-11-12T12:00:00Z",
                status,
            },
        ];
        render(
            tela === "desktop" ? (
                <TabelaParticipantes participantes={participantes} />
            ) : (
                <CardsParticipantes participantes={participantes} contexto="situacao" />
            )
        );
        expect(screen.getByText(rotulo).closest(".chip")).toHaveClass(
            `bg-[var(--color-${tom}-soft)]`,
            `text-[var(--color-${tom})]`
        );
    }
);
