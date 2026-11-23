import { criarAcaoRetirada } from "../participantes/AcaoRegistrarRetirada";
import type { UserRole } from "../../types/auth";
import type { EstudoApi } from "../../types/estudo";
import { CardsParticipantes } from "./CardsParticipantes";
import { TabelaParticipantes } from "./TabelaParticipantes";
import { useTelaEstreita } from "../../hooks/useTelaEstreita";
import { useEffect, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { BotaoAtualizar } from "../ui/BotaoAtualizar";
import { listarParticipantesPorEstudo } from "../../services/participantes";
import type { ParticipanteApi } from "../../types/participante";
import { obterMensagemErroApi } from "../../utils/erros-api";
import { ErrorMessage } from "../ui/ErrorMessage";
import { HistoricoParticipante } from "./HistoricoParticipante";

type Props = {
    estudo: Pick<EstudoApi, "id" | "title" | "status">;
    token: string;
    perfil: UserRole;
};

export function ParticipantesEstudo({ estudo, token, perfil }: Props) {
    const telaEstreita = useTelaEstreita();
    const [participantes, setParticipantes] = useState<ParticipanteApi[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [historicoId, setHistoricoId] = useState<number | null>(null);
    const [mensagem, setMensagem] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        listarParticipantesPorEstudo(estudo.id, token, controller.signal)
            .then((dados) => {
                if (!controller.signal.aborted) setParticipantes(dados);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setErro(
                        obterMensagemErroApi(error, "Não foi possível carregar os participantes.")
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [estudo.id, token, tentativa]);

    function atualizar() {
        setCarregando(true);
        setErro("");
        setTentativa((atual) => atual + 1);
    }

    if (historicoId !== null) {
        return (
            <HistoricoParticipante
                key={`${estudo.id}:${historicoId}:${token}`}
                estudoId={estudo.id}
                participanteId={historicoId}
                token={token}
                onVoltar={() => setHistoricoId(null)}
            />
        );
    }

    function atualizarParticipante(atualizado: ParticipanteApi) {
        setParticipantes((atuais) =>
            atuais.map((item) => (item.id === atualizado.id ? atualizado : item))
        );
        setMensagem("Retirada registrada com sucesso.");
    }

    const acaoRetirada = criarAcaoRetirada({
        perfil,
        estadoEstudo: estudo.status,
        estudoTitulo: estudo.title,
        token,
        onRetiradaRegistrada: atualizarParticipante,
    });

    const acoes = (participante: ParticipanteApi) => (
        <div className="flex flex-col gap-2">
            <Button
                variant="secondary"
                aria-label={`Ver histórico: ${participante.candidateName}`}
                onPress={() => setHistoricoId(participante.id)}
            >
                Ver histórico
            </Button>
            {acaoRetirada?.(participante)}
        </div>
    );

    return (
        <section aria-labelledby="participantes-estudo-heading" className="flex flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2
                        id="participantes-estudo-heading"
                        className="text-lg font-semibold text-[var(--color-title)] [overflow-wrap:anywhere]"
                    >
                        Participantes do estudo
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                        Consulte as inclusões e a situação dos participantes deste estudo.
                    </p>
                </div>
                <BotaoAtualizar
                    rotulo="Atualizar participantes"
                    desabilitado={carregando}
                    onAtualizar={atualizar}
                />
            </header>
            {mensagem && (
                <p
                    role="status"
                    className="rounded-lg bg-[var(--color-success-soft)] p-3 text-sm text-[var(--color-success)]"
                >
                    {mensagem}
                </p>
            )}
            {carregando ? (
                <div role="status" className="flex items-center justify-center gap-3 p-8">
                    <Spinner size="sm" aria-hidden="true" /> Carregando participantes...
                </div>
            ) : erro ? (
                <div className="flex flex-col items-center gap-3 p-8">
                    <ErrorMessage message={erro} />
                    <Button variant="secondary" onPress={atualizar}>
                        Tentar novamente
                    </Button>
                </div>
            ) : participantes.length === 0 ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-white p-8 text-center">
                    <p className="font-semibold text-[var(--color-title)] [overflow-wrap:anywhere]">
                        Nenhum participante incluído
                    </p>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                        Os candidatos aparecerão aqui após a inclusão pelo recrutamento.
                    </p>
                </div>
            ) : telaEstreita ? (
                <CardsParticipantes
                    participantes={participantes}
                    contexto="situacao"
                    acoes={acoes}
                />
            ) : (
                <TabelaParticipantes participantes={participantes} acoes={acoes} />
            )}
        </section>
    );
}
