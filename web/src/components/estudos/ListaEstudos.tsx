import { CardPadrao, GradeCards } from "../ui/CardPadrao";
import { Button } from "@heroui/react";
import { Eye, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import type { EstudoApi } from "../../types/estudo";
import { formatarPeriodo, podeEditarEstudo } from "../../utils/estudos";
import type { AuthenticatedUser } from "../../types/auth";
import { SeloEstadoEstudo } from "./SeloEstadoEstudo";

type ListaEstudosProps = {
    estudos: EstudoApi[];
    pesquisador: Pick<AuthenticatedUser, "id" | "name" | "role">;
    onEditar: (estudo: EstudoApi) => void;
};

export function ListaEstudos({ estudos, pesquisador, onEditar }: ListaEstudosProps) {
    if (estudos.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
                <strong className="text-sm font-semibold text-[var(--color-title)]">
                    Nenhum estudo encontrado
                </strong>
                <span className="text-sm text-[var(--color-muted)]">
                    Ajuste a busca ou cadastre um novo estudo.
                </span>
            </div>
        );
    }

    return (
        <GradeCards rotulo="Lista de estudos clínicos">
            {estudos.map((estudo) => (
                <li key={estudo.id}>
                    <CardPadrao
                        titulo={estudo.title}
                        selo={<SeloEstadoEstudo estado={estudo.status} />}
                        acoes={
                            <div>
                                <Link
                                    to={`/estudos/${estudo.id}`}
                                    className="button button--create"
                                    aria-label={`Visualizar estudo: ${estudo.title}`}
                                >
                                    <Eye size={18} aria-hidden="true" /> Visualizar estudo
                                </Link>
                                {podeEditarEstudo(estudo, pesquisador) ? (
                                    <Button
                                        variant="ghost"
                                        onPress={() => onEditar(estudo)}
                                        aria-label={`Editar estudo: ${estudo.title}`}
                                    >
                                        <Pencil size={18} aria-hidden="true" /> Editar estudo
                                    </Button>
                                ) : (
                                    <p>Somente leitura</p>
                                )}
                            </div>
                        }
                    >
                        <dl className="card-padrao__dados">
                            <div>
                                <dt>Responsável</dt>
                                <dd>
                                    {estudo.responsibleUserId === pesquisador.id
                                        ? pesquisador.name
                                        : `Pesquisador #${estudo.responsibleUserId}`}
                                </dd>
                            </div>
                            <div>
                                <dt>Limite de participantes</dt>
                                <dd>{estudo.participantLimit}</dd>
                            </div>
                            <div>
                                <dt>Período</dt>
                                <dd>{formatarPeriodo(estudo.startDate, estudo.endDate)}</dd>
                            </div>
                        </dl>
                    </CardPadrao>
                </li>
            ))}
        </GradeCards>
    );
}
