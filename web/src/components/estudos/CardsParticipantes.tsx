import type { ReactNode } from "react";
import { Chip } from "@heroui/react";
import type { ParticipanteApi } from "../../types/participante";
import { CardPadrao, GradeCards } from "../ui/CardPadrao";
import { SELOS_PARTICIPANTE, formatarDataInclusao } from "../../utils/participantes";

type Props = {
    participantes: ParticipanteApi[];
    contexto: "inclusao" | "situacao";
    renderizarAcoes?: (participante: ParticipanteApi) => ReactNode;
};

export function CardsParticipantes({ participantes, contexto, renderizarAcoes }: Props) {
    const incluido = contexto === "inclusao";
    return (
        <GradeCards
            rotulo={
                contexto === "inclusao"
                    ? "Lista de participantes incluídos"
                    : "Participantes do estudo"
            }
        >
            {participantes.map((participante) => {
                const selo =
                    SELOS_PARTICIPANTE[participante.status] ?? SELOS_PARTICIPANTE.indisponivel;

                return (
                    <li key={participante.id}>
                        <CardPadrao
                            titulo={participante.candidateName}
                            acoes={renderizarAcoes?.(participante)}
                            selo={
                                <Chip size="sm" variant="soft" className={selo.classes}>
                                    <Chip.Label>{selo.rotulo}</Chip.Label>
                                </Chip>
                            }
                        >
                            <dl className="card-padrao__dados">
                                {incluido && (
                                    <div>
                                        <dt>Vínculo</dt>
                                        <dd>Participante #{participante.id}</dd>
                                    </div>
                                )}
                                <div>
                                    <dt>Data de inclusão</dt>
                                    <dd>{formatarDataInclusao(participante.includedAt)}</dd>
                                </div>
                            </dl>
                        </CardPadrao>
                    </li>
                );
            })}
        </GradeCards>
    );
}
