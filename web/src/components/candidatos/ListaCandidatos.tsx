import type { CandidatoApi } from "../../types/candidato";
import { GradeCards } from "../ui/CardPadrao";
import { CardCandidato, type ContextoCandidatos } from "./CardCandidato";

type Props = ContextoCandidatos & {
    candidatos: CandidatoApi[];
    participantesCandidatoIds?: ReadonlySet<number>;
};

export function ListaCandidatos({ candidatos, participantesCandidatoIds, ...contexto }: Props) {
    if (candidatos.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
                <strong className="text-sm font-semibold text-[var(--color-title)]">
                    Nenhum candidato encontrado
                </strong>
                <span className="text-sm text-[var(--color-muted)]">
                    Não há candidatos cadastrados para os critérios selecionados.
                </span>
            </div>
        );
    }
    return (
        <GradeCards rotulo="Lista de candidatos">
            {candidatos.map((candidato) => (
                <li key={candidato.id}>
                    <CardCandidato
                        candidato={candidato}
                        jaIncluido={Boolean(participantesCandidatoIds?.has(candidato.id))}
                        {...contexto}
                    />
                </li>
            ))}
        </GradeCards>
    );
}
