import { Chip } from "@heroui/react";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import type { ParticipanteApi } from "../../types/participante";
import { CardPadrao, GradeCards } from "../ui/CardPadrao";
import { SELOS_PARTICIPANTE, formatarDataInclusao } from "../../utils/participantes";

type Props = {
    participantes: ParticipanteApi[];
    contexto: "inclusao" | "situacao";
    exibirSituacao?: boolean;
    acoes?: (participante: ParticipanteApi) => ReactNode;
};

/** Compartilha cards de participantes, com situação e ações opcionais da agenda. @author Lívia */
export function CardsParticipantes({
    participantes,
    contexto,
    exibirSituacao = false,
    acoes,
}: Props) {
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
                const seloSituacao =
                    SELOS_PARTICIPANTE[participante.status] ?? SELOS_PARTICIPANTE.indisponivel;
                const selo = incluido ? SELOS_PARTICIPANTE.inclusao : seloSituacao;

                return (
                    <li key={participante.id}>
                        <CardPadrao
                            titulo={participante.candidateName}
                            acoes={acoes?.(participante)}
                            selo={
                                <Chip size="sm" variant="soft" className={selo.classes}>
                                    <Chip.Label>
                                        <span className="inline-flex items-center gap-1">
                                            {incluido && (
                                                <CheckCircle2 size={13} aria-hidden="true" />
                                            )}
                                            {selo.rotulo}
                                        </span>
                                    </Chip.Label>
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
                                {exibirSituacao && (
                                    <div>
                                        <dt>Situação</dt>
                                        <dd>
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                className={seloSituacao.classes}
                                            >
                                                <Chip.Label>{seloSituacao.rotulo}</Chip.Label>
                                            </Chip>
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </CardPadrao>
                    </li>
                );
            })}
        </GradeCards>
    );
}
