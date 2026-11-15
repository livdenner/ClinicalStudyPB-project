import { calcularOcupacao } from "../../utils/estudos";

type BarraProgressoParticipantesProps = {
    tituloEstudo: string;
    participantes: number;
    limite: number;
};

export function BarraProgressoParticipantes({
    tituloEstudo,
    participantes,
    limite,
}: BarraProgressoParticipantesProps) {
    const percentual = calcularOcupacao(participantes, limite);

    const corBarra = percentual >= 100 ? "bg-[var(--color-warning)]" : "bg-[var(--color-info)]";

    return (
        <div className="participant-count">
            <span>
                {participantes} / {limite}
            </span>
            <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8edf2]"
                role="progressbar"
                aria-label={`Vagas preenchidas em ${tituloEstudo}`}
                aria-valuemin={0}
                aria-valuemax={limite}
                aria-valuenow={participantes}
            >
                <span
                    className={`block h-full rounded-full transition-all duration-300 ${corBarra}`}
                    style={{ width: `${percentual}%` }}
                />
            </div>
        </div>
    );
}
