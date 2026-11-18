import { Chip, Table } from "@heroui/react";
import { CheckCircle2, Users } from "lucide-react";
import type { ParticipanteApi } from "../../types/participante";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";

type Props = {
    estudoTitulo: string;
    limiteVagas: number;
    participantes: ParticipanteApi[];
    carregando: boolean;
    erro: string;
    onTentarNovamente: () => void;
};

function formatarInclusao(iso: string): string {
    const dataObj = new Date(iso);
    if (Number.isNaN(dataObj.getTime())) return "—";
    const data = dataObj.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
    const hora = dataObj.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
    return `${data} às ${hora}`;
}

export function PainelParticipantesVagas({
    estudoTitulo,
    limiteVagas,
    participantes,
    carregando,
    erro,
    onTentarNovamente,
}: Props) {
    const vagasOcupadas = participantes.length;
    const vagasDisponiveis = Math.max(0, limiteVagas - vagasOcupadas);
    const estudoLotado = limiteVagas > 0 && vagasDisponiveis === 0;
    const percentualOcupacao =
        limiteVagas > 0 ? Math.min(100, Math.round((vagasOcupadas / limiteVagas) * 100)) : 0;

    return (
        <section
            className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
            aria-labelledby="participantes-vagas-heading"
        >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                        <Users size={20} aria-hidden="true" />
                    </div>
                    <div>
                        <h2
                            id="participantes-vagas-heading"
                            className="text-base font-bold text-[var(--color-title)]"
                        >
                            Participantes e vagas do estudo
                        </h2>
                        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                            Acompanhamento de inclusões confirmadas e limite de vagas de{" "}
                            {estudoTitulo}
                        </p>
                    </div>
                </div>

                <div
                    role="status"
                    aria-label="Indicador de vagas do estudo"
                    className="flex flex-wrap items-center gap-3"
                >
                    <div className="rounded-lg border border-[var(--color-border)] bg-[#F8FAFC] px-3.5 py-2 text-xs">
                        <span className="text-[var(--color-muted)]">Vagas ocupadas: </span>
                        <strong className="font-bold text-[var(--color-title)]">
                            {vagasOcupadas} de {limiteVagas}
                        </strong>
                    </div>

                    <div className="rounded-lg border border-[var(--color-border)] bg-[#F8FAFC] px-3.5 py-2 text-xs">
                        <span className="text-[var(--color-muted)]">Saldo disponível: </span>
                        <strong
                            className={`font-bold ${
                                estudoLotado
                                    ? "text-[var(--color-warning)]"
                                    : "text-[var(--color-info)]"
                            }`}
                        >
                            {vagasDisponiveis} {vagasDisponiveis === 1 ? "vaga" : "vagas"}
                        </strong>
                    </div>

                    <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            estudoLotado
                                ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
                                : "bg-[var(--color-info-soft)] text-[var(--color-info)]"
                        }`}
                    >
                        {estudoLotado ? "Limite de vagas atingido" : "Vagas disponíveis"}
                    </span>
                </div>
            </div>

            <div className="border-b border-[var(--color-border)] bg-[#F8FAFC] px-5 py-3">
                <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-muted)]">
                    <span>Ocupação de vagas do estudo</span>
                    <span className="font-semibold text-[var(--color-title)]">
                        {percentualOcupacao}% ({vagasOcupadas}/{limiteVagas})
                    </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                        className={`h-full rounded-full transition-all ${
                            estudoLotado ? "bg-[var(--color-warning)]" : "bg-[var(--color-primary)]"
                        }`}
                        style={{ width: `${percentualOcupacao}%` }}
                    />
                </div>
            </div>

            {carregando ? (
                <p role="status" className="p-6 text-center text-sm text-[var(--color-muted)]">
                    Carregando participantes...
                </p>
            ) : erro ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <ErrorMessage message={erro} />
                    <Button type="button" variant="secondary" onClick={onTentarNovamente}>
                        Tentar novamente
                    </Button>
                </div>
            ) : participantes.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-5 py-8 text-center">
                    <strong className="text-sm font-semibold text-[var(--color-title)]">
                        Nenhum participante incluído
                    </strong>
                    <span className="text-xs text-[var(--color-muted)]">
                        Candidatos elegíveis e com consentimento aceito aparecerão aqui após a
                        inclusão.
                    </span>
                </div>
            ) : (
                <Table variant="secondary">
                    <Table.ScrollContainer className="overflow-x-auto">
                        <Table.Content
                            aria-label="Lista de participantes incluídos"
                            className="w-full min-w-[460px] text-left text-sm"
                        >
                            <Table.Header>
                                {["Participante", "Vínculo", "Data de inclusão", "Situação"].map(
                                    (titulo) => (
                                        <Table.Column
                                            key={titulo}
                                            id={titulo}
                                            isRowHeader={titulo === "Participante"}
                                            className="rounded-none bg-[var(--color-primary)] px-5 py-3 text-xs font-semibold text-white after:hidden"
                                        >
                                            {titulo}
                                        </Table.Column>
                                    )
                                )}
                            </Table.Header>
                            <Table.Body items={participantes}>
                                {(participante) => (
                                    <Table.Row
                                        id={participante.id}
                                        textValue={participante.candidateName}
                                        className="group border-b border-[var(--color-border)]"
                                    >
                                        <Table.Cell className="break-words border-[var(--color-border)] px-5 py-3.5 font-semibold text-[var(--color-title)] group-hover:bg-slate-50">
                                            {participante.candidateName}
                                        </Table.Cell>
                                        <Table.Cell className="border-[var(--color-border)] px-5 py-3.5 text-xs text-[var(--color-muted)] group-hover:bg-slate-50">
                                            Participante #{participante.id}
                                        </Table.Cell>
                                        <Table.Cell className="border-[var(--color-border)] px-5 py-3.5 text-[var(--color-text)] group-hover:bg-slate-50">
                                            {formatarInclusao(participante.includedAt)}
                                        </Table.Cell>
                                        <Table.Cell className="border-[var(--color-border)] px-5 py-3.5 group-hover:bg-slate-50">
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                className="bg-[var(--color-success-soft)] font-semibold text-[var(--color-success)]"
                                            >
                                                <Chip.Label>
                                                    <span className="inline-flex items-center gap-1">
                                                        <CheckCircle2
                                                            size={13}
                                                            aria-hidden="true"
                                                        />
                                                        Incluído
                                                    </span>
                                                </Chip.Label>
                                            </Chip>
                                        </Table.Cell>
                                    </Table.Row>
                                )}
                            </Table.Body>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>
            )}
        </section>
    );
}
