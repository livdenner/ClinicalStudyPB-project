import { useId } from "react";
import { Card } from "@heroui/react";
import { ListChecks } from "lucide-react";
import {
    TIPOS_CRITERIO_ESTUDO,
    type CriterioEstudo,
    type TipoCriterioEstudo,
} from "../../../types/criterio-estudo";

type Props = { criterios: CriterioEstudo[] };
const tipos: TipoCriterioEstudo[] = ["INCLUSION", "EXCLUSION"];

export function ListaCriteriosEstudo({ criterios }: Props) {
    const id = useId();
    return (
        <div className="grid grid-cols-2 items-start gap-5 max-[800px]:grid-cols-1">
            {tipos.map((tipo) => {
                const itens = criterios.filter((criterio) => criterio.type === tipo);
                const tituloId = `${id}-${tipo}`;
                return (
                    <Card
                        key={tipo}
                        data-tipo={tipo}
                        render={(props) => <section {...props} />}
                        aria-labelledby={tituloId}
                        className="group gap-0 rounded-xl border border-[#C8E6D2] bg-white p-5 shadow-none data-[tipo=EXCLUSION]:border-[#FECDD3]"
                    >
                        <Card.Header className="gap-2 border-b border-[#C8E6D2] pb-4 group-data-[tipo=EXCLUSION]:border-[#FECDD3]">
                            <Card.Title
                                render={(props) => <h3 {...props} />}
                                id={tituloId}
                                className="text-lg font-semibold text-[#166534] group-data-[tipo=EXCLUSION]:text-[#9F1239]"
                            >
                                Critérios de{" "}
                                {TIPOS_CRITERIO_ESTUDO[tipo].toLocaleLowerCase("pt-BR")}
                            </Card.Title>
                            <Card.Description className="text-sm text-[var(--color-muted)]">
                                {tipo === "INCLUSION"
                                    ? "Condições que o candidato precisa atender."
                                    : "Condições que impedem a participação."}
                            </Card.Description>
                        </Card.Header>
                        <Card.Content className="pt-4">
                            {itens.length ? (
                                <ul className="list-disc space-y-4 pl-5 marker:text-[#166534] group-data-[tipo=EXCLUSION]:marker:text-[#9F1239]">
                                    {itens.map((criterio) => (
                                        <li
                                            key={criterio.id}
                                            className="pl-1 text-sm leading-relaxed text-[var(--color-text)]"
                                        >
                                            <p className="whitespace-pre-wrap break-words">
                                                {criterio.description}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex flex-col items-center gap-3 py-8 text-center">
                                    <span className="rounded-xl bg-[#EFFAF3] p-3 text-[#166534] group-data-[tipo=EXCLUSION]:bg-[#FFF1F2] group-data-[tipo=EXCLUSION]:text-[#9F1239]">
                                        <ListChecks size={22} aria-hidden="true" />
                                    </span>
                                    <p className="text-sm text-[var(--color-muted)]">
                                        Nenhum critério de{" "}
                                        {TIPOS_CRITERIO_ESTUDO[tipo].toLocaleLowerCase("pt-BR")}{" "}
                                        cadastrado.
                                    </p>
                                </div>
                            )}
                        </Card.Content>
                    </Card>
                );
            })}
        </div>
    );
}
