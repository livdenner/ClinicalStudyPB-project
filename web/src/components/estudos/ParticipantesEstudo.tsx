import { useEffect, useState } from "react";
import { Button, Chip, Spinner } from "@heroui/react";
import { BotaoAtualizar } from "../ui/BotaoAtualizar";
import { listarParticipantesPorEstudo } from "../../services/participantes";
import type { ParticipanteApi } from "../../types/participante";
import { obterMensagemErroApi } from "../../utils/erros-api";
import { ErrorMessage } from "../ui/ErrorMessage";

export function ParticipantesEstudo({ estudoId, token }: { estudoId: number; token: string }) {
    const [participantes, setParticipantes] = useState<ParticipanteApi[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        listarParticipantesPorEstudo(estudoId, token, controller.signal)
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
    }, [estudoId, token, tentativa]);

    function atualizar() {
        setCarregando(true);
        setErro("");
        setTentativa((atual) => atual + 1);
    }

    return (
        <section aria-labelledby="participantes-estudo-heading" className="flex flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2
                        id="participantes-estudo-heading"
                        className="text-lg font-semibold text-[var(--color-title)]"
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
                    <p className="font-semibold text-[var(--color-title)]">
                        Nenhum participante incluído
                    </p>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                        Os candidatos aparecerão aqui após a inclusão pelo recrutamento.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
                    <table
                        aria-label="Participantes do estudo"
                        className="w-full min-w-[520px] text-left text-sm"
                    >
                        <thead className="bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]">
                            <tr>
                                {["Nome", "Data de inclusão", "Situação"].map((coluna) => (
                                    <th
                                        key={coluna}
                                        scope="col"
                                        className="px-5 py-3 font-semibold"
                                    >
                                        {coluna}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {participantes.map((participante) => {
                                const data = new Date(participante.includedAt);
                                const ativo = participante.status === "ACTIVE";
                                return (
                                    <tr
                                        key={participante.id}
                                        className="border-t border-[var(--color-border)] hover:bg-[var(--color-row-hover)]"
                                    >
                                        <th
                                            scope="row"
                                            className="px-5 py-4 font-semibold text-[var(--color-title)]"
                                        >
                                            {participante.candidateName}
                                        </th>
                                        <td className="px-5 py-4 text-[var(--color-text)]">
                                            {Number.isNaN(data.getTime())
                                                ? "—"
                                                : data.toLocaleString("pt-BR", {
                                                      dateStyle: "short",
                                                      timeStyle: "short",
                                                  })}
                                        </td>
                                        <td className="px-5 py-4">
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                className={
                                                    ativo
                                                        ? "bg-[var(--color-info-soft)] text-[var(--color-info)]"
                                                        : "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]"
                                                }
                                            >
                                                <Chip.Label>
                                                    {ativo
                                                        ? "Ativo"
                                                        : participante.status === "WITHDRAWN"
                                                          ? "Retirado"
                                                          : "Situação indisponível"}
                                                </Chip.Label>
                                            </Chip>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
