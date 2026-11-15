import { Button, Dropdown } from "@heroui/react";
import { ArrowRightLeft, ChevronDown, LockKeyhole, Pencil } from "lucide-react";
import type { EstadoEstudo, EstudoApi } from "../../types/estudo";

type Props = {
    estudo: EstudoApi;
    edicaoPermitida: boolean;
    mensagemBloqueio: string;
    emProcessamento: boolean;
    alteracaoEstadoPermitida: boolean;
    origemCancelamento: EstadoEstudo | null;
    proximaTransicao: { estado: EstadoEstudo; rotulo: string | null } | null;
    onEditar: () => void;
    onTransicionar: (estado: EstadoEstudo) => void;
};

export function CabecalhoEstudo({
    estudo,
    edicaoPermitida,
    mensagemBloqueio,
    emProcessamento,
    proximaTransicao,
    alteracaoEstadoPermitida,
    origemCancelamento,
    onEditar,
    onTransicionar,
}: Props) {
    const acoes: { estado: EstadoEstudo; rotulo: string }[] = [];
    if (alteracaoEstadoPermitida && estudo.status !== "CLOSED") {
        if (proximaTransicao?.rotulo)
            acoes.push({ estado: proximaTransicao.estado, rotulo: proximaTransicao.rotulo });
        if (estudo.status === "RECRUITMENT")
            acoes.push({ estado: "PLANNING", rotulo: "Voltar ao planejamento" });
        if (estudo.status === "CANCELLED") {
            if (origemCancelamento === "PLANNING" || origemCancelamento === "RECRUITMENT") {
                acoes.push({ estado: origemCancelamento, rotulo: "Restaurar estudo" });
            }
        } else acoes.push({ estado: "CANCELLED", rotulo: "Cancelar estudo" });
    }
    return (
        <header className="flex items-start justify-between gap-5 max-[600px]:flex-col">
            <div className="min-w-0">
                <p className="mb-2 text-sm font-medium text-[var(--color-primary)]">
                    Estudo #{estudo.id}
                </p>
                <h1
                    id="estudo-heading"
                    className="break-words text-[28px] font-bold tracking-tight text-[var(--color-title)]"
                >
                    {estudo.title}
                </h1>
            </div>
            <div className="flex max-w-full flex-col items-end gap-3 max-[600px]:w-full max-[600px]:items-stretch">
                <div className="flex flex-wrap items-end justify-end gap-4 max-[600px]:justify-start">
                    {edicaoPermitida && (
                        <div className="flex flex-col gap-1.5">
                            <Button
                                variant="primary"
                                className="min-h-11"
                                isDisabled={emProcessamento}
                                onPress={onEditar}
                            >
                                <Pencil size={18} aria-hidden="true" /> Editar estudo
                            </Button>
                        </div>
                    )}
                    {acoes.length > 0 && (
                        <Dropdown>
                            <Dropdown.Trigger
                                className="button button--secondary button--create group"
                                isDisabled={emProcessamento}
                            >
                                <ArrowRightLeft size={17} aria-hidden="true" />
                                Alterar estado{" "}
                                <ChevronDown
                                    size={17}
                                    aria-hidden="true"
                                    className="transition-transform group-aria-expanded:rotate-180"
                                />
                            </Dropdown.Trigger>
                            <Dropdown.Popover
                                placement="bottom end"
                                className="min-w-56 rounded-xl border border-[var(--color-border)]"
                            >
                                <Dropdown.Menu aria-label="Transições do estudo">
                                    {acoes.map((acao) => (
                                        <Dropdown.Item
                                            key={acao.estado}
                                            id={acao.estado}
                                            textValue={acao.rotulo}
                                            isDisabled={emProcessamento}
                                            onAction={() => onTransicionar(acao.estado)}
                                            className={`min-h-11 ${acao.estado === "CANCELLED" ? "border-t border-[var(--color-border)] text-[var(--color-error)]" : ""}`}
                                        >
                                            {acao.rotulo}
                                        </Dropdown.Item>
                                    ))}
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown>
                    )}
                </div>
                {!edicaoPermitida && (
                    <p className="flex max-w-sm items-start gap-2 rounded-lg border border-[var(--color-border)] bg-slate-50 px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                        <LockKeyhole size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                        {mensagemBloqueio}
                    </p>
                )}
            </div>
        </header>
    );
}
