import { useEffect, useRef, useState } from "react";
import { Chip, Spinner } from "@heroui/react";
import { ArrowLeft, History } from "lucide-react";
import { obterHistoricoParticipante } from "../../services/participantes";
import type { HistoricoParticipanteApi } from "../../types/historico-participante";
import { STATUS_VISITA_LABELS } from "../../types/visita-agendada";
import { STATUS_VISITA_CLASSES } from "../../config/visitas";
import { formatarHorarioAgendamento } from "../../utils/agendamento";
import { obterMensagemErroApi } from "../../utils/erros-api";
import { CardPadrao } from "../ui/CardPadrao";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";

type Props = {
    estudoId: number;
    participanteId: number;
    token: string;
    onVoltar: () => void;
};

export function HistoricoParticipante({ estudoId, participanteId, token, onVoltar }: Props) {
    const [dados, setDados] = useState<HistoricoParticipanteApi | null>(null);
    const [erro, setErro] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [tentativa, setTentativa] = useState(0);
    const tituloRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        tituloRef.current?.focus();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        obterHistoricoParticipante(estudoId, participanteId, token, controller.signal)
            .then((historico) => {
                if (!controller.signal.aborted) setDados(historico);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted)
                    setErro(
                        obterMensagemErroApi(
                            error,
                            "Não foi possível carregar o histórico do participante."
                        )
                    );
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [estudoId, participanteId, token, tentativa]);

    return (
        <section
            className="historico-participante"
            aria-labelledby="historico-participante-heading"
        >
            <div>
                <Button variant="secondary" onClick={onVoltar}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Voltar para participantes
                </Button>
            </div>
            <header className="historico-participante__cabecalho">
                <span className="historico-participante__icone">
                    <History size={24} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2
                        id="historico-participante-heading"
                        ref={tituloRef}
                        tabIndex={-1}
                        className="text-xl font-semibold text-[var(--color-title)] [overflow-wrap:anywhere]"
                    >
                        Histórico do participante
                    </h2>
                    {dados && !carregando && !erro && (
                        <p className="mt-1 font-medium text-[var(--color-text)] [overflow-wrap:anywhere]">
                            {dados.participant.candidateName}
                        </p>
                    )}
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                        Visitas e registros do acompanhamento. Horários de Fortaleza.
                    </p>
                </div>
            </header>
            {carregando ? (
                <div role="status" className="flex items-center justify-center gap-3 p-8">
                    <Spinner size="sm" aria-hidden="true" /> Carregando histórico...
                </div>
            ) : erro ? (
                <div className="flex flex-col items-center gap-3 p-8">
                    <ErrorMessage message={erro} />
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setErro("");
                            setDados(null);
                            setCarregando(true);
                            setTentativa((atual) => atual + 1);
                        }}
                    >
                        Tentar novamente
                    </Button>
                </div>
            ) : (
                dados && (
                    <>
                        {dados.visits.length === 0 && (
                            <CardPadrao titulo="Nenhuma visita no histórico">
                                <p>
                                    As visitas aparecerão aqui após o agendamento. Desfechos e
                                    resultados serão exibidos quando registrados pela equipe.
                                </p>
                            </CardPadrao>
                        )}
                        <ol
                            aria-label="Linha do tempo do participante"
                            className="historico-participante__linha"
                        >
                            {dados.visits.map((visita) => (
                                <li
                                    key={visita.id}
                                    className={`historico-participante__evento historico-participante__evento--${visita.status.toLowerCase()}`}
                                >
                                    <CardPadrao
                                        titulo={visita.plannedVisitName}
                                        selo={
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                className={STATUS_VISITA_CLASSES[visita.status]}
                                            >
                                                <Chip.Label>
                                                    {STATUS_VISITA_LABELS[visita.status]}
                                                </Chip.Label>
                                            </Chip>
                                        }
                                    >
                                        <dl className="card-padrao__dados">
                                            <div>
                                                <dt>Data da visita</dt>
                                                <dd>
                                                    <time dateTime={visita.scheduledAt}>
                                                        {formatarHorarioAgendamento(
                                                            visita.scheduledAt
                                                        )}
                                                    </time>
                                                </dd>
                                            </div>
                                        </dl>
                                        <details className="historico-participante__detalhes">
                                            <summary>Ver detalhes e resultados</summary>
                                            <div className="historico-participante__conteudo">
                                                {visita.outcomeAt && (
                                                    <p>
                                                        Desfecho registrado em{" "}
                                                        {formatarHorarioAgendamento(
                                                            visita.outcomeAt
                                                        )}
                                                    </p>
                                                )}
                                                {visita.outcomeNote && (
                                                    <p>
                                                        Observação do desfecho: {visita.outcomeNote}
                                                    </p>
                                                )}
                                                {visita.results.length === 0 ? (
                                                    <p>
                                                        Nenhum resultado registrado para esta
                                                        visita.
                                                    </p>
                                                ) : (
                                                    <ul
                                                        aria-label={`Resultados de ${visita.plannedVisitName}`}
                                                        className="flex flex-col gap-3"
                                                    >
                                                        {visita.results.map((resultado) => (
                                                            <li
                                                                key={resultado.activityId}
                                                                className="historico-participante__resultado"
                                                            >
                                                                <dl className="card-padrao__dados">
                                                                    <div>
                                                                        <dt>Atividade</dt>
                                                                        <dd>
                                                                            #{resultado.activityId}
                                                                        </dd>
                                                                    </div>
                                                                    <div>
                                                                        <dt>Resultado</dt>
                                                                        <dd>{resultado.value}</dd>
                                                                    </div>
                                                                    <div>
                                                                        <dt>Registrado em</dt>
                                                                        <dd>
                                                                            {formatarHorarioAgendamento(
                                                                                resultado.recordedAt
                                                                            )}
                                                                        </dd>
                                                                    </div>
                                                                    {resultado.note && (
                                                                        <div>
                                                                            <dt>Observação</dt>
                                                                            <dd>
                                                                                {resultado.note}
                                                                            </dd>
                                                                        </div>
                                                                    )}
                                                                </dl>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </details>
                                    </CardPadrao>
                                </li>
                            ))}
                            {dados.participant.withdrawal && (
                                <li className="historico-participante__evento historico-participante__evento--cancelled">
                                    <CardPadrao
                                        titulo="Retirada do participante"
                                        selo={
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                className="bg-[var(--color-error-soft)] text-[var(--color-error)]"
                                            >
                                                <Chip.Label>Retirado</Chip.Label>
                                            </Chip>
                                        }
                                    >
                                        <dl className="card-padrao__dados">
                                            <div>
                                                <dt>Data da retirada</dt>
                                                <dd>
                                                    {formatarHorarioAgendamento(
                                                        dados.participant.withdrawal.withdrawnAt
                                                    )}
                                                </dd>
                                            </div>
                                        </dl>
                                        <details className="historico-participante__detalhes">
                                            <summary>Ver detalhes da retirada</summary>
                                            <div className="historico-participante__conteudo">
                                                <p>Motivo: {dados.participant.withdrawal.reason}</p>
                                                <p>
                                                    Visitas canceladas:{" "}
                                                    {
                                                        dados.participant.withdrawal
                                                            .cancelledVisitCount
                                                    }
                                                </p>
                                            </div>
                                        </details>
                                    </CardPadrao>
                                </li>
                            )}
                        </ol>
                    </>
                )
            )}
        </section>
    );
}
