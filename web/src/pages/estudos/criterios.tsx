import { useEffect, useRef, useState } from "react";
import { Button, Spinner, toast } from "@heroui/react";
import { LockKeyhole, Plus } from "lucide-react";
import { ListaCriteriosEstudo } from "../../components/estudos/criterios/ListaCriteriosEstudo";
import { ModalNovoCriterio } from "../../components/estudos/criterios/ModalNovoCriterio";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { ApiClientError } from "../../services/api/apiClient";
import { cadastrarCriterioEstudo, listarCriteriosEstudo } from "../../services/criterios-estudo";
import { obterEstudo } from "../../services/estudos";
import type { AuthenticatedUser } from "../../types/auth";
import type { EstudoApi } from "../../types/estudo";
import type { CriterioEstudo, DadosCriterioEstudo } from "../../types/criterio-estudo";
import { obterMensagemErroApi } from "../../utils/erros-api";
import { podeEditarEstudo } from "../../utils/estudos";

type Props = {
    estudo: EstudoApi;
    usuario: AuthenticatedUser;
    token: string;
    onAtualizarEstudo: (estudo: EstudoApi) => void;
    onProcessamentoChange: (emProcessamento: boolean) => void;
};

export function CriteriosEstudo({
    estudo,
    usuario,
    token,
    onAtualizarEstudo,
    onProcessamentoChange,
}: Props) {
    const [dados, setDados] = useState<{ estudo: EstudoApi; criterios: CriterioEstudo[] } | null>(
        null
    );
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [modalAberto, setModalAberto] = useState(false);
    const [requerAtualizacao, setRequerAtualizacao] = useState(false);
    const [tentativa, setTentativa] = useState(0);
    const ultimaLeitura = useRef<{ id: number; version: number; token: string } | null>(null);
    const gravando = useRef(false);

    useEffect(() => {
        const ultima = ultimaLeitura.current;
        if (ultima?.id === estudo.id && ultima.version === estudo.version && ultima.token === token)
            return;
        const controller = new AbortController();
        async function carregar() {
            try {
                const atual = await obterEstudo(estudo.id, token, controller.signal);
                const criterios = await listarCriteriosEstudo(estudo.id, token, controller.signal);
                if (controller.signal.aborted) return;
                ultimaLeitura.current = { id: atual.id, version: atual.version, token };
                setDados({ estudo: atual, criterios });
                setErro("");
                setRequerAtualizacao(false);
                if (atual.version !== estudo.version || atual.status !== estudo.status)
                    onAtualizarEstudo(atual);
            } catch (error) {
                if (!controller.signal.aborted)
                    setErro(obterMensagemErroApi(error, "Não foi possível carregar os critérios."));
            } finally {
                if (!controller.signal.aborted) setCarregando(false);
            }
        }
        void carregar();
        return () => controller.abort();
    }, [estudo.id, estudo.version, estudo.status, token, tentativa, onAtualizarEstudo]);

    const emProcessamento = carregando || salvando;
    const editavel = podeEditarEstudo(estudo, usuario);
    const acoesBloqueadas =
        emProcessamento ||
        requerAtualizacao ||
        Boolean(erro) ||
        dados?.estudo.version !== estudo.version ||
        dados?.estudo.status !== estudo.status;

    useEffect(() => {
        onProcessamentoChange(emProcessamento);
        return () => onProcessamentoChange(false);
    }, [emProcessamento, onProcessamentoChange]);

    function atualizar() {
        setModalAberto(false);
        setCarregando(true);
        setErro("");
        ultimaLeitura.current = null;
        setTentativa((atual) => atual + 1);
    }

    async function cadastrar(valores: DadosCriterioEstudo) {
        if (gravando.current || acoesBloqueadas || !editavel)
            throw new ApiClientError("Atualize os critérios antes de tentar novamente.", {
                status: 409,
            });
        gravando.current = true;
        setSalvando(true);
        try {
            await cadastrarCriterioEstudo(estudo.id, valores, token);
            toast.success("Critério cadastrado com sucesso.");
            atualizar();
        } catch (error) {
            if (!(error instanceof ApiClientError) || error.status !== 400) {
                setRequerAtualizacao(true);
                setErro(
                    obterMensagemErroApi(
                        error,
                        "Não foi possível confirmar o cadastro. Atualize os dados antes de tentar novamente."
                    )
                );
            }
            throw error;
        } finally {
            gravando.current = false;
            setSalvando(false);
        }
    }

    return (
        <section className="flex flex-col gap-5" aria-labelledby="criterios-estudo-heading">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h2
                            id="criterios-estudo-heading"
                            className="text-xl font-semibold text-[var(--color-title)]"
                        >
                            Critérios do estudo
                        </h2>
                        {!editavel && (
                            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text)]">
                                <LockKeyhole size={14} aria-hidden="true" />
                                Somente leitura
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                        Condições de inclusão e exclusão dos candidatos.
                    </p>
                </div>
                {editavel && (
                    <Button
                        variant="primary"
                        className="button--create"
                        isDisabled={acoesBloqueadas}
                        onPress={() => setModalAberto(true)}
                    >
                        <Plus size={18} aria-hidden="true" />
                        Novo critério
                    </Button>
                )}
            </header>
            {carregando && (
                <div
                    role="status"
                    className="flex items-center justify-center gap-3 py-10 text-sm text-[var(--color-muted)]"
                >
                    <Spinner size="sm" color="current" role="presentation" aria-hidden="true" />
                    Carregando critérios...
                </div>
            )}
            {erro && !modalAberto && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white p-4">
                    <ErrorMessage message={erro} />
                    <Button variant="secondary" isDisabled={emProcessamento} onPress={atualizar}>
                        Tentar novamente
                    </Button>
                </div>
            )}
            {!carregando && dados && <ListaCriteriosEstudo criterios={dados.criterios} />}
            {modalAberto && (
                <ModalNovoCriterio
                    requerAtualizacao={requerAtualizacao}
                    onFechar={() => setModalAberto(false)}
                    onSalvar={cadastrar}
                    onAtualizar={atualizar}
                />
            )}
        </section>
    );
}
