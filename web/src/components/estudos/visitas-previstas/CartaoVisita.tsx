import { useId, useState, type ReactNode } from "react";
import { Button, Card, Chip } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import type { VisitaPrevista } from "../../../types/visita-prevista";
import { formatarMes } from "../../../utils/estudos";

export function CartaoVisita({ visita, acoes }: { visita: VisitaPrevista; acoes: ReactNode }) {
    const [expandido, setExpandido] = useState(false);
    const atividadesId = useId();
    const [ano, mes, dia] = visita.plannedDate.split("-");
    const mesExibido = formatarMes(new Date(`${visita.plannedDate}T12:00:00`));
    return (
        <Card className="gap-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white p-0 shadow-none">
            <Card.Header className="flex flex-row items-start gap-4 p-5 max-[600px]:flex-wrap">
                <time
                    dateTime={visita.plannedDate}
                    aria-label={`${dia}/${mes}/${ano}`}
                    className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-[var(--color-primary-soft)] py-3 text-[var(--color-primary-dark)]"
                >
                    <span className="text-2xl font-bold leading-none">{dia}</span>
                    <span className="mt-1 text-xs font-semibold uppercase">{mesExibido}</span>
                    <span className="mt-1 text-xs">{ano}</span>
                </time>
                <div className="min-w-0 flex-1">
                    <Chip size="sm" variant="soft" className="mb-2 bg-slate-100 text-slate-600">
                        <Chip.Label>Visita {String(visita.position).padStart(2, "0")}</Chip.Label>
                    </Chip>
                    <Card.Title className="break-words text-base font-semibold text-[var(--color-title)]">
                        {visita.name}
                    </Card.Title>
                    <Button
                        variant="ghost"
                        className="mt-1 min-h-11 gap-2 px-0 text-sm text-[var(--color-primary)]"
                        aria-expanded={expandido}
                        aria-controls={atividadesId}
                        onPress={() => setExpandido(!expandido)}
                    >
                        {visita.activities.length}{" "}
                        {visita.activities.length === 1 ? "atividade" : "atividades"}
                        <ChevronDown
                            size={16}
                            aria-hidden="true"
                            className={expandido ? "rotate-180" : ""}
                        />
                        <span className="sr-only"> de {visita.name}</span>
                    </Button>
                </div>
                {acoes}
            </Card.Header>
            <div id={atividadesId} hidden={!expandido}>
                <ol
                    aria-label={`Atividades de ${visita.name}`}
                    className="flex flex-col gap-4 border-t border-[var(--color-border)] bg-slate-50/70 p-5 sm:pl-25"
                >
                    {visita.activities.map((atividade) => (
                        <li key={atividade.id} className="flex items-start gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-xs font-medium text-[var(--color-muted)]">
                                {atividade.position}
                            </span>
                            <div className="min-w-0">
                                <h4 className="break-words text-sm font-semibold text-[var(--color-title)]">
                                    {atividade.name}
                                </h4>
                                <Card.Description className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-text)]">
                                    {atividade.description}
                                </Card.Description>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </Card>
    );
}
