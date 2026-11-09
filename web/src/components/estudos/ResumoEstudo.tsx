import { Surface } from "@heroui/react";
import type { EstudoApi } from "../../types/estudo";
import { SeloEstadoEstudo } from "./SeloEstadoEstudo";

type Props = {
    estudo: EstudoApi;
    responsavel: string;
};

export function ResumoEstudo({ estudo, responsavel }: Props) {
    return (
        <Surface
            variant="transparent"
            className="rounded-xl bg-linear-to-r from-[var(--color-primary-dark)] to-[var(--color-primary)] p-6 text-white"
        >
            <dl
                aria-label="Resumo do estudo"
                className="grid grid-cols-4 gap-5 max-[900px]:grid-cols-2 max-[600px]:grid-cols-1"
            >
                <div>
                    <dt className="text-xs uppercase tracking-wide text-white/90">Estado</dt>
                    <dd className="mt-2">
                        <SeloEstadoEstudo estado={estudo.status} />
                    </dd>
                </div>
                <div>
                    <dt className="text-xs uppercase tracking-wide text-white/90">
                        Limite de participantes
                    </dt>
                    <dd className="mt-2 text-base font-semibold">{estudo.participantLimit}</dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-wide text-white/90">Responsável</dt>
                    <dd className="mt-2 break-words text-base font-semibold">{responsavel}</dd>
                </div>
                <div>
                    <dt className="text-xs uppercase tracking-wide text-white/90">Período</dt>
                    <dd className="mt-2 text-base font-semibold">
                        {estudo.startDate.split("-").reverse().join("/")} –{" "}
                        {estudo.endDate.split("-").reverse().join("/")}
                    </dd>
                </div>
            </dl>
        </Surface>
    );
}
