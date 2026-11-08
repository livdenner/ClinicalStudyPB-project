import { Button } from "@heroui/react";
import { LockKeyhole, Pencil } from "lucide-react";
import type { EstadoEstudo, EstudoApi } from "../../types/estudo";

type Props = {
    estudo: EstudoApi;
    edicaoPermitida: boolean;
    mensagemBloqueio: string;
    emProcessamento: boolean;
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
    onEditar,
    onTransicionar,
}: Props) {
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
            <div className="flex max-w-full flex-col items-end gap-3 max-[600px]:items-start">
                <div className="flex flex-wrap gap-3 empty:hidden">
                    {edicaoPermitida && (
                        <Button
                            variant="primary"
                            isDisabled={emProcessamento}
                            onPress={onEditar}
                            className="shrink-0"
                        >
                            <Pencil size={18} aria-hidden="true" /> Editar estudo
                        </Button>
                    )}
                    {proximaTransicao && (
                        <Button
                            variant="secondary"
                            isDisabled={emProcessamento}
                            onPress={() => onTransicionar(proximaTransicao.estado)}
                            className="border border-[var(--color-primary)] bg-white font-semibold text-[var(--color-primary-dark)] hover:bg-[var(--color-primary-soft)]"
                        >
                            {proximaTransicao.rotulo}
                        </Button>
                    )}
                </div>
                {!edicaoPermitida && (
                    <p className="flex max-w-sm items-start gap-2 rounded-lg border border-[var(--color-border)] bg-slate-50 px-3 py-2 text-base font-medium text-[var(--color-text)]">
                        <LockKeyhole size={18} aria-hidden="true" className="mt-1 shrink-0" />
                        {mensagemBloqueio}
                    </p>
                )}
            </div>
        </header>
    );
}
