import { useEffect, useState } from "react";
import { verificarRequisitosTransicao } from "../../services/requisitos-transicao";
import type { EstudoApi } from "../../types/estudo";
import { obterMensagemErroAcesso } from "../../utils/erros-api";

export function useRequisitosTransicao(
    estudo: EstudoApi | null,
    token: string,
    habilitada: boolean
) {
    const [aberto, setAberto] = useState(false);
    const [tentativa, setTentativa] = useState(0);
    const [resultado, setResultado] = useState<{
        chave: string;
        motivo: string | null;
        falhou: boolean;
    } | null>(null);
    const id = estudo?.id;
    const estado = estudo?.status;
    const chave = JSON.stringify([id, estado, estudo?.version, token, tentativa]);
    const precisaVerificar =
        habilitada && (estado === "PLANNING" || estado === "RECRUITMENT" || estado === "EXECUTION");

    useEffect(() => {
        if (!aberto || !precisaVerificar || id === undefined || estado === undefined) return;
        const controller = new AbortController();
        verificarRequisitosTransicao(id, estado, token, controller.signal)
            .then((motivo) => {
                if (!controller.signal.aborted) setResultado({ chave, motivo, falhou: false });
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setResultado({
                    chave,
                    motivo:
                        obterMensagemErroAcesso(error) ??
                        "Não foi possível verificar os requisitos. Tente novamente.",
                    falhou: true,
                });
            });
        return () => controller.abort();
    }, [aberto, precisaVerificar, id, estado, token, chave]);

    function onMenuChange(menuAberto: boolean) {
        if (menuAberto) setTentativa((atual) => atual + 1);
        setAberto(menuAberto);
    }

    return {
        motivo: precisaVerificar
            ? resultado?.chave === chave
                ? resultado.motivo
                : "Verificando requisitos…"
            : null,
        falhou: precisaVerificar && resultado?.chave === chave && resultado.falhou,
        onMenuChange,
        onReverificar: () => setTentativa((atual) => atual + 1),
    };
}
