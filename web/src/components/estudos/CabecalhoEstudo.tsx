import { Button, Dropdown } from "@heroui/react";
import { ArrowRightLeft, ChevronDown, LockKeyhole, Pencil, Users } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import type { EstadoEstudo, EstudoApi } from "../../types/estudo";

type Props = {
    estudo: EstudoApi;
    edicaoPermitida: boolean;
    mensagemBloqueio: string;
    recrutamentoHref?: string;
    emProcessamento: boolean;
    alteracaoEstadoPermitida: boolean;
    origemCancelamento: EstadoEstudo | null;
    proximaTransicao: { estado: EstadoEstudo; rotulo: string | null } | null;
    requisitosTransicao: {
        motivo: string | null;
        falhou: boolean;
        onMenuChange: (aberto: boolean) => void;
        onReverificar: () => void;
    };
    onEditar: () => void;
    onTransicionar: (estado: EstadoEstudo) => void;
};

export function CabecalhoEstudo({
    estudo,
    edicaoPermitida,
    mensagemBloqueio,
    recrutamentoHref,
    emProcessamento,
    proximaTransicao,
    alteracaoEstadoPermitida,
    origemCancelamento,
    requisitosTransicao,
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
                    {recrutamentoHref && (
                        <RouterLink to={recrutamentoHref} className="button button--create">
                            <Users size={18} aria-hidden="true" /> Gerenciar candidatos
                        </RouterLink>
                    )}
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
                        <Dropdown onOpenChange={requisitosTransicao.onMenuChange}>
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
                                className="min-w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--color-border)]"
                            >
                                <Dropdown.Menu aria-label="Transições do estudo">
                                    {acoes.map((acao) => (
                                        <Dropdown.Item
                                            key={acao.estado}
                                            id={acao.estado}
                                            textValue={acao.rotulo}
                                            aria-label={acao.rotulo}
                                            aria-describedby={
                                                acao.estado === proximaTransicao?.estado &&
                                                requisitosTransicao.motivo
                                                    ? "motivo-bloqueio-transicao"
                                                    : undefined
                                            }
                                            isDisabled={
                                                emProcessamento ||
                                                (acao.estado === proximaTransicao?.estado &&
                                                    Boolean(requisitosTransicao.motivo))
                                            }
                                            onAction={() => onTransicionar(acao.estado)}
                                            className={`min-h-11 whitespace-normal data-[disabled=true]:opacity-100 ${acao.estado === "CANCELLED" ? "border-t border-[var(--color-border)] text-[var(--color-error)]" : ""}`}
                                        >
                                            <span className="flex max-w-72 flex-col gap-1">
                                                <span>{acao.rotulo}</span>
                                                {acao.estado === proximaTransicao?.estado &&
                                                    requisitosTransicao.motivo && (
                                                        <span
                                                            id="motivo-bloqueio-transicao"
                                                            className="text-xs leading-relaxed text-[var(--color-muted)]"
                                                            aria-live="polite"
                                                        >
                                                            {requisitosTransicao.motivo}
                                                        </span>
                                                    )}
                                            </span>
                                        </Dropdown.Item>
                                    ))}
                                    {requisitosTransicao.falhou && (
                                        <Dropdown.Item
                                            id="verificar-requisitos"
                                            textValue="Verificar requisitos novamente"
                                            shouldCloseOnSelect={false}
                                            onAction={requisitosTransicao.onReverificar}
                                            className="min-h-11"
                                        >
                                            Verificar requisitos novamente
                                        </Dropdown.Item>
                                    )}
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown>
                    )}
                </div>
                {!edicaoPermitida && (
                    <p className="flex max-w-sm items-start gap-1.5 text-sm text-[var(--color-muted)]">
                        <LockKeyhole size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
                        {mensagemBloqueio}
                    </p>
                )}
            </div>
        </header>
    );
}
