import { useState } from "react";
import { Button } from "@heroui/react";
import { UserRoundMinus } from "lucide-react";
import { registrarRetiradaParticipante } from "../../services/participantes";
import type { ParticipanteApi } from "../../types/participante";
import type { UserRole } from "../../types/auth";
import type { EstadoEstudo } from "../../types/estudo";
import { ModalRegistrarRetirada } from "./ModalRegistrarRetirada";

type Props = {
    participante: ParticipanteApi;
    estudoTitulo: string;
    token: string;
    onRetiradaRegistrada: (participante: ParticipanteApi) => void;
};

type Contexto = Omit<Props, "participante"> & {
    perfil: UserRole;
    estadoEstudo: EstadoEstudo;
};

export function criarAcaoRetirada({ perfil, estadoEstudo, ...props }: Contexto) {
    const estudoPermiteRetirada =
        estadoEstudo === "PLANNING" ||
        estadoEstudo === "RECRUITMENT" ||
        estadoEstudo === "EXECUTION";
    if (perfil !== "COORDINATOR" || !estudoPermiteRetirada) return undefined;

    return (participante: ParticipanteApi) => {
        if (participante.status !== "ACTIVE") return undefined;
        return <AcaoRegistrarRetirada participante={participante} {...props} />;
    };
}

function AcaoRegistrarRetirada({ participante, estudoTitulo, token, onRetiradaRegistrada }: Props) {
    const [aberto, setAberto] = useState(false);

    async function confirmar(motivo: string) {
        const atualizado = await registrarRetiradaParticipante(
            participante.studyId,
            participante.id,
            motivo,
            token
        );
        setAberto(false);
        onRetiradaRegistrada(atualizado);
    }

    return (
        <>
            <Button
                variant="secondary"
                aria-label={`Registrar retirada: ${participante.candidateName}`}
                onPress={() => setAberto(true)}
                className="min-h-11 border border-[var(--color-border)] bg-white text-[var(--color-neutral)] hover:bg-[var(--color-neutral-soft)]"
            >
                <UserRoundMinus size={17} aria-hidden="true" />
                Registrar retirada
            </Button>
            {aberto && (
                <ModalRegistrarRetirada
                    participante={participante}
                    estudoTitulo={estudoTitulo}
                    onFechar={() => setAberto(false)}
                    onConfirmar={confirmar}
                />
            )}
        </>
    );
}
