import { ESTADOS_ESTUDO } from "../../config/estados-estudo";
import { Card } from "@heroui/react";
import { ClipboardList, Users, Activity, Lock } from "lucide-react";

type TipoCardResumo = "total" | "recrutamento" | "execucao" | "encerrado";

type CardResumoEstudosProps = {
    titulo: string;
    quantidade: number;
    tipo: TipoCardResumo;
};

const icones = {
    total: ClipboardList,
    recrutamento: Users,
    execucao: Activity,
    encerrado: Lock,
};

const cores = {
    total: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
    recrutamento: ESTADOS_ESTUDO.RECRUITMENT.classes,
    execucao: ESTADOS_ESTUDO.EXECUTION.classes,
    encerrado: ESTADOS_ESTUDO.CLOSED.classes,
};

export function CardResumoEstudos({ titulo, quantidade, tipo }: CardResumoEstudosProps) {
    const Icone = icones[tipo];

    return (
        <Card className="flex min-w-0 flex-row items-start gap-3 rounded-xl border border-[#dce5ed] bg-white p-4 shadow-none">
            <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cores[tipo]}`}
                aria-hidden="true"
            >
                <Icone size={22} strokeWidth={1.8} />
            </div>

            <div className="flex min-w-0 flex-col gap-1">
                <strong className="text-2xl font-bold leading-none text-[#1b2d40]">
                    {quantidade}
                </strong>

                <span className="mt-1 text-md font-medium text-[#52677c]">{titulo}</span>
            </div>
        </Card>
    );
}
