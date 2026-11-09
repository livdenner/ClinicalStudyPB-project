import { useEffect, useRef, useState } from "react";
import { Button, Chip, Spinner, toast } from "@heroui/react";
import { ListOrdered, LockKeyhole, Plus, RefreshCw } from "lucide-react";
import { ListaVisitasPrevistas } from "../../components/estudos/visitas-previstas/ListaVisitasPrevistas";
import { ModalVisitaPrevista } from "../../components/estudos/visitas-previstas/ModalVisitaPrevista";
import { ModalExcluirVisitaPrevista } from "../../components/estudos/visitas-previstas/ModalExcluirVisitaPrevista";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { ApiClientError } from "../../services/api/apiClient";
import { obterEstudo } from "../../services/estudos";
import {
    excluirVisitaPrevista,
    listarVisitasPrevistas,
    salvarVisitaPrevista,
} from "../../services/visitas-previstas";
import type { AuthenticatedUser } from "../../types/auth";
import type { EstudoApi } from "../../types/estudo";
import type { DadosVisitaPrevista, VisitaPrevista } from "../../types/visita-prevista";
import { obterMensagemErroApi } from "../../utils/erros-api";
import { podeEditarEstudo } from "../../utils/estudos";

type Props = {
    estudo: EstudoApi;
    usuario: AuthenticatedUser;
    token: string;
    onAtualizarEstudo: (estudo: EstudoApi) => void;
    onProcessamentoChange: (emProcessamento: boolean) => void;
};

export function VisitasPrevistasEstudo({
    estudo,
    usuario,
    token,
    onAtualizarEstudo,
    onProcessamentoChange,
}: Props) {
    const [dados, setDados] = useState<{ estudo: EstudoApi; visitas: VisitaPrevista[] } | null>(
        null
    );
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [requerAtualizacao, setRequerAtualizacao] = useState(false);
    const [tentativa, setTentativa] = useState(0);
    const [modal, setModal] = useState<{ visita?: VisitaPrevista } | null>(null);
    const [excluindo, setExcluindo] = useState<VisitaPrevista | null>(null);
    const leituraAtual = useRef<{ id: number; version: number; token: string } | null>(null);
    const gravando = useRef(false);

    useEffect(() => {
        const ultima = leituraAtual.current;
        if (ultima?.id === estudo.id && ultima.version === estudo.version && ultima.token === token)
            return;
        const controller = new AbortController();
        async function carregar() {
            try {
                const atual = await obterEstudo(estudo.id, token, controller.signal);
                const visitas = await listarVisitasPrevistas(estudo.id, token, controller.signal);
                if (controller.signal.aborted) return;
                leituraAtual.current = { id: atual.id, version: atual.version, token };
                setDados({ estudo: atual, visitas });
                setRequerAtualizacao(false);
                setErro("");
                if (atual.version !== estudo.version) onAtualizarEstudo(atual);
            } catch (error) {
                if (controller.signal.aborted) return;
                setErro(
                    obterMensagemErroApi(error, "Não foi possível carregar as visitas previstas.")
                );
            } finally {
                if (!controller.signal.aborted) setCarregando(false);
            }
        }
        void carregar();
        return () => controller.abort();
    }, [estudo.id, estudo.version, token, tentativa, onAtualizarEstudo]);

    const emProcessamento = carregando || salvando;
    const acoesBloqueadas =
        emProcessamento ||
        requerAtualizacao ||
        Boolean(erro) ||
        dados?.estudo.version !== estudo.version;
    const editavel = podeEditarEstudo(dados?.estudo ?? estudo, usuario);

    useEffect(() => {
        onProcessamentoChange(emProcessamento);
        return () => onProcessamentoChange(false);
    }, [emProcessamento, onProcessamentoChange]);

    function atualizar() {
        setModal(null);
        setExcluindo(null);
        setCarregando(true);
        setErro("");
        leituraAtual.current = null;
        setTentativa((atual) => atual + 1);
    }

    async function executar(operacao: (versao: number) => Promise<unknown>, mensagem: string) {
        if (gravando.current || acoesBloqueadas || !dados || !editavel) {
            setRequerAtualizacao(true);
            throw new ApiClientError("Atualize os dados para conferir as ações disponíveis.", {
                status: 409,
            });
        }
        gravando.current = true;
        setSalvando(true);
        try {
            await operacao(dados.estudo.version);
            toast.success(mensagem);
            atualizar();
        } catch (error) {
            if (!(error instanceof ApiClientError) || error.status !== 400)
                setRequerAtualizacao(true);
            throw error;
        } finally {
            gravando.current = false;
            setSalvando(false);
        }
    }

    async function salvar(dadosVisita: DadosVisitaPrevista) {
        await executar(
            (versao) =>
                salvarVisitaPrevista(estudo.id, dadosVisita, versao, token, modal?.visita?.id),
            "Visita prevista salva com sucesso."
        );
    }

    async function excluir() {
        if (!excluindo) return;
        await executar(
            (versao) => excluirVisitaPrevista(estudo.id, excluindo.id, versao, token),
            "Visita prevista excluída."
        );
    }

    const visitas = dados?.visitas ?? [];
    const ultimaEmRecrutamento =
        (dados?.estudo ?? estudo).status === "RECRUITMENT" && visitas.length === 1;

    return (
        <section aria-labelledby="visitas-previstas-heading" className="flex flex-col gap-5">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h2
                            id="visitas-previstas-heading"
                            className="text-xl font-semibold tracking-tight text-[var(--color-title)]"
                        >
                            Visitas previstas
                        </h2>
                        {dados && (
                            <Chip
                                size="sm"
                                variant="soft"
                                className="bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
                            >
                                <Chip.Label>
                                    {visitas.length} {visitas.length === 1 ? "visita" : "visitas"}
                                </Chip.Label>
                            </Chip>
                        )}
                        {!editavel && (
                            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text)]">
                                <LockKeyhole size={14} aria-hidden="true" /> Somente leitura
                            </span>
                        )}
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                        Sequência de visitas e atividades do protocolo.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="ghost"
                        className="min-h-11 text-[var(--color-primary)]"
                        isDisabled={emProcessamento}
                        onPress={atualizar}
                    >
                        <RefreshCw size={17} aria-hidden="true" /> Atualizar
                    </Button>
                    {editavel && (
                        <Button
                            variant="primary"
                            className="min-h-11"
                            isDisabled={acoesBloqueadas}
                            onPress={() => setModal({})}
                        >
                            <Plus size={18} aria-hidden="true" /> Nova visita
                        </Button>
                    )}
                </div>
            </header>
            {carregando ? (
                <div
                    role="status"
                    className="flex items-center justify-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white py-12"
                >
                    <Spinner size="sm" aria-hidden="true" /> Carregando visitas previstas...
                </div>
            ) : erro ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
                    <ErrorMessage message={erro} />
                </div>
            ) : (
                <>
                    {requerAtualizacao && !modal && !excluindo && (
                        <ErrorMessage message="Atualize as visitas para conferir os dados antes de continuar." />
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
                        <ListOrdered size={17} aria-hidden="true" />
                        <span>Sequência das visitas</span>
                        {ultimaEmRecrutamento && editavel && (
                            <span className="ml-auto text-[var(--color-text)]">
                                Mantenha ao menos uma visita durante o recrutamento.
                            </span>
                        )}
                    </div>
                    <ListaVisitasPrevistas
                        visitas={visitas}
                        editavel={editavel}
                        acoesBloqueadas={acoesBloqueadas}
                        podeExcluir={!ultimaEmRecrutamento}
                        onEditar={(visita) => setModal({ visita })}
                        onExcluir={setExcluindo}
                    />
                </>
            )}
            {modal && dados && (
                <ModalVisitaPrevista
                    estudo={dados.estudo}
                    visita={modal.visita}
                    quantidade={visitas.length}
                    requerAtualizacao={requerAtualizacao}
                    onFechar={() => setModal(null)}
                    onSalvar={salvar}
                    onAtualizar={atualizar}
                />
            )}
            {excluindo && (
                <ModalExcluirVisitaPrevista
                    visita={excluindo}
                    onFechar={() => setExcluindo(null)}
                    onConfirmar={excluir}
                    onAtualizar={atualizar}
                />
            )}
        </section>
    );
}
