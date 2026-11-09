import { Button } from "@heroui/react";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import type { VisitaPrevista } from "../../../types/visita-prevista";
import { CartaoVisita } from "./CartaoVisita";

type Props = {
    visitas: VisitaPrevista[];
    editavel: boolean;
    acoesBloqueadas: boolean;
    podeExcluir: boolean;
    onEditar: (visita: VisitaPrevista) => void;
    onExcluir: (visita: VisitaPrevista) => void;
};

export function ListaVisitasPrevistas({
    visitas,
    editavel,
    acoesBloqueadas,
    podeExcluir,
    onEditar,
    onExcluir,
}: Props) {
    if (visitas.length === 0) {
        return (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-6 py-12 text-center">
                <span className="mb-4 rounded-2xl bg-[var(--color-primary-soft)] p-4 text-[var(--color-primary)]">
                    <CalendarDays size={28} aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold text-[var(--color-title)]">
                    Nenhuma visita prevista
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-muted)]">
                    {editavel
                        ? "Adicione a primeira visita e defina as atividades do protocolo."
                        : "As visitas deste protocolo ainda não foram cadastradas."}
                </p>
            </div>
        );
    }
    return (
        <ol aria-label="Visitas previstas do estudo" className="flex flex-col gap-4">
            {visitas.map((visita) => (
                <li key={visita.id}>
                    <CartaoVisita
                        visita={visita}
                        acoes={
                            editavel && (
                                <div className="flex flex-wrap items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        className="min-h-11 text-[var(--color-primary)]"
                                        isDisabled={acoesBloqueadas}
                                        aria-label={`Editar visita: ${visita.name}`}
                                        onPress={() => onEditar(visita)}
                                    >
                                        <Pencil size={16} aria-hidden="true" /> Editar
                                    </Button>
                                    <Button
                                        isIconOnly
                                        variant="ghost"
                                        className="h-11 w-11 text-[#B42318]"
                                        aria-label={`Excluir visita: ${visita.name}`}
                                        isDisabled={acoesBloqueadas || !podeExcluir}
                                        onPress={() => onExcluir(visita)}
                                    >
                                        <Trash2 size={18} aria-hidden="true" />
                                    </Button>
                                </div>
                            )
                        }
                    />
                </li>
            ))}
        </ol>
    );
}
