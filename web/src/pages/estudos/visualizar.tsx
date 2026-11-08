import { useEffect, useState } from "react";
import { Button, Card, Link, Spinner, Tabs, toast } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ModalEditarEstudo } from "../../components/estudos/ModalEditarEstudo";
import { ModalTransicaoEstudo } from "../../components/estudos/ModalTransicaoEstudo";
import { CabecalhoEstudo } from "../../components/estudos/CabecalhoEstudo";
import { ResumoEstudo } from "../../components/estudos/ResumoEstudo";
import { ehEstadoEstudo, ESTADOS_ESTUDO } from "../../config/estados-estudo";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { ApiClientError } from "../../services/api/apiClient";
import { alterarEstadoEstudo, editarEstudo, obterEstudo } from "../../services/estudos";
import type { AuthenticatedUser } from "../../types/auth";
import type { DadosEstudoApi, EstadoEstudo, EstudoApi } from "../../types/estudo";
import { podeEditarEstudo, podeAlterarEstadoEstudo } from "../../utils/estudos";
import { obterMensagemErroAcesso } from "../../utils/erros-api";
import { VisitasPrevistasEstudo } from "./visitas-previstas";

const MENSAGENS_EDICAO_BLOQUEADA: Partial<Record<EstadoEstudo, string>> = {
    EXECUTION: "Edição bloqueada durante a execução.",
    CLOSED: "Estudo encerrado. Edição bloqueada.",
    CANCELLED: "Estudo cancelado. Edição bloqueada.",
};

export function VisualizarEstudoPage() {
    const { session } = useAuth();
    const { id: parametroId } = useParams();
    if (!session) return <Navigate to="/login" replace />;
    if (session.user.role !== "RESEARCHER" && session.user.role !== "COORDINATOR") {
        return (
            <section className="py-12 text-center">
                <h1 className="text-2xl font-bold text-[var(--color-title)]">Acesso restrito</h1>
                <p className="my-4">
                    A consulta de estudos está disponível para pesquisadores e coordenadores.
                </p>
            </section>
        );
    }
    const id = Number(parametroId);
    const idValido = Boolean(
        parametroId && /^[1-9]\d*$/.test(parametroId) && Number.isSafeInteger(id)
    );
    return (
        <div className="flex flex-col gap-4">
            <Link
                href="/estudos"
                render={(props) =>
                    "href" in props ? (
                        <RouterLink {...props} to={props.href} />
                    ) : (
                        <span {...props} />
                    )
                }
                className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-3 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
                <ArrowLeft size={18} aria-hidden="true" /> Voltar para estudos
            </Link>
            {idValido ? (
                <DetalhesEstudo
                    key={`${id}:${session.accessToken}`}
                    id={id}
                    token={session.accessToken}
                    pesquisador={session.user}
                />
            ) : (
                <EstudoNaoEncontrado />
            )}
        </div>
    );
}

function EstudoNaoEncontrado() {
    return (
        <section className="py-12 text-center">
            <h1 className="text-2xl font-bold text-[var(--color-title)]">Estudo não encontrado</h1>
            <p className="mt-3 text-[var(--color-muted)]">
                Não foi localizado um estudo com este identificador.
            </p>
        </section>
    );
}

function DetalhesEstudo({
    id,
    token,
    pesquisador,
}: {
    id: number;
    token: string;
    pesquisador: AuthenticatedUser;
}) {
    const [estudo, setEstudo] = useState<EstudoApi | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<{
        mensagem: string;
        status: number | null;
    } | null>(null);
    const [tentativa, setTentativa] = useState(0);
    const [editando, setEditando] = useState(false);
    const [transicao, setTransicao] = useState<EstadoEstudo | null>(null);
    const [visitasMontadas, setVisitasMontadas] = useState(false);
    const [visitasEmProcessamento, setVisitasEmProcessamento] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        obterEstudo(id, token, controller.signal)
            .then((dados) => {
                if (!controller.signal.aborted) setEstudo(dados);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                const status = error instanceof ApiClientError ? error.status : null;
                const mensagem =
                    obterMensagemErroAcesso(error) ??
                    "Não foi possível carregar o estudo. Verifique a conexão e tente novamente.";
                setErro({ mensagem, status });
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [id, token, tentativa]);

    async function salvar(dados: DadosEstudoApi) {
        if (!estudo) return;
        if (!podeEditarEstudo(estudo, pesquisador)) {
            throw new ApiClientError(
                "Não é permitido editar este estudo com o usuário ou estado atual.",
                { status: 403 }
            );
        }
        const atualizado = await editarEstudo(
            estudo.id,
            {
                ...dados,
                responsibleUserId: estudo.responsibleUserId,
            },
            token
        );
        setEstudo(atualizado);
        setEditando(false);
        toast.success("Estudo atualizado com sucesso.");
    }

    async function transicionar() {
        if (!estudo || !transicao) return;
        if (!podeAlterarEstadoEstudo(estudo, pesquisador)) {
            throw new ApiClientError("Você não tem permissão para alterar o estado deste estudo.", {
                status: 403,
            });
        }
        const atualizado = await alterarEstadoEstudo(
            estudo.id,
            { status: transicao, expectedStatus: estudo.status },
            token
        );
        setEstudo(atualizado);
        setTransicao(null);
        toast.success("Estado do estudo atualizado com sucesso.");
    }

    function atualizarEstudo() {
        setTransicao(null);
        setCarregando(true);
        setErro(null);
        setTentativa((atual) => atual + 1);
    }

    if (carregando) {
        return (
            <div role="status" className="flex items-center justify-center gap-3 p-8 text-center">
                <Spinner
                    size="sm"
                    color="current"
                    aria-hidden="true"
                    role="presentation"
                    className="text-[var(--color-primary)]"
                />
                <span>Carregando estudo...</span>
            </div>
        );
    }
    if (erro?.status === 404) return <EstudoNaoEncontrado />;
    if (erro) {
        return (
            <section className="flex flex-col items-center gap-3 py-12 text-center">
                <h1 className="text-2xl font-bold text-[var(--color-title)]">
                    Não foi possível abrir o estudo
                </h1>
                <ErrorMessage message={erro.mensagem} />
                <Button
                    variant="secondary"
                    onPress={() => {
                        setCarregando(true);
                        setErro(null);
                        setTentativa((atual) => atual + 1);
                    }}
                >
                    Tentar novamente
                </Button>
                {erro.status === 401 && (
                    <Link
                        href="/login"
                        className="text-[var(--color-primary)] underline"
                        render={(props) =>
                            "href" in props ? (
                                <RouterLink {...props} to={props.href} />
                            ) : (
                                <span {...props} />
                            )
                        }
                    >
                        Ir para o login
                    </Link>
                )}
            </section>
        );
    }
    if (!estudo) return null;

    const responsavel =
        estudo.responsibleUserId === pesquisador.id
            ? pesquisador.name
            : `Pesquisador #${estudo.responsibleUserId}`;
    const estado = ehEstadoEstudo(estudo.status) ? ESTADOS_ESTUDO[estudo.status] : null;
    const edicaoPermitida = podeEditarEstudo(estudo, pesquisador);
    const mensagemBloqueio =
        pesquisador.id !== estudo.responsibleUserId
            ? "Apenas o responsável pode editar."
            : (MENSAGENS_EDICAO_BLOQUEADA[estudo.status] ?? "Edição indisponível.");

    return (
        <section className="flex flex-col gap-6" aria-labelledby="estudo-heading">
            <CabecalhoEstudo
                estudo={estudo}
                edicaoPermitida={edicaoPermitida}
                mensagemBloqueio={mensagemBloqueio}
                emProcessamento={visitasEmProcessamento}
                proximaTransicao={
                    podeAlterarEstadoEstudo(estudo, pesquisador) && estado?.proximo
                        ? { estado: estado.proximo, rotulo: estado.acao }
                        : null
                }
                onEditar={() => setEditando(true)}
                onTransicionar={setTransicao}
            />
            <ResumoEstudo estudo={estudo} responsavel={responsavel} />
            <Tabs
                variant="secondary"
                defaultSelectedKey="visao-geral"
                onSelectionChange={(aba) => {
                    if (aba === "visitas-previstas") setVisitasMontadas(true);
                }}
                className="w-full"
            >
                <Tabs.List
                    aria-label="Seções do estudo"
                    className="mb-5 w-full min-w-0 gap-5 overflow-x-auto border-b border-[var(--color-border)] p-0"
                >
                    <Tabs.Tab
                        id="visao-geral"
                        className="min-h-12 w-auto shrink-0 rounded-none px-1 text-sm font-medium data-[selected=true]:text-[var(--color-primary)]"
                    >
                        Visão geral
                        <Tabs.Indicator className="top-auto bottom-0 h-0.5 rounded-none bg-[var(--color-primary)] shadow-none" />
                    </Tabs.Tab>
                    <Tabs.Tab
                        id="visitas-previstas"
                        className="min-h-12 w-auto shrink-0 rounded-none px-1 text-sm font-medium data-[selected=true]:text-[var(--color-primary)]"
                    >
                        Visitas previstas
                        <Tabs.Indicator className="top-auto bottom-0 h-0.5 rounded-none bg-[var(--color-primary)] shadow-none" />
                    </Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel id="visao-geral" className="m-0 p-0">
                    <Card
                        render={(props) => <section {...props} />}
                        aria-labelledby="sobre-estudo-heading"
                        className="gap-0 rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-none"
                    >
                        <Card.Header>
                            <Card.Title
                                render={(props) => <h2 {...props} />}
                                id="sobre-estudo-heading"
                                className="text-lg font-semibold text-[var(--color-title)]"
                            >
                                Sobre o estudo
                            </Card.Title>
                        </Card.Header>
                        <Card.Content className="gap-0">
                            <h3 className="mt-5 text-sm font-medium text-[var(--color-text)]">
                                Objetivo
                            </h3>
                            <Card.Description className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-muted)]">
                                {estudo.objective}
                            </Card.Description>
                        </Card.Content>
                    </Card>
                </Tabs.Panel>
                <Tabs.Panel
                    id="visitas-previstas"
                    shouldForceMount={visitasMontadas}
                    className="m-0 p-0 data-[inert=true]:hidden"
                >
                    <VisitasPrevistasEstudo
                        estudo={estudo}
                        usuario={pesquisador}
                        token={token}
                        onAtualizarEstudo={setEstudo}
                        onProcessamentoChange={setVisitasEmProcessamento}
                    />
                </Tabs.Panel>
            </Tabs>
            {editando && (
                <ModalEditarEstudo
                    estudo={estudo}
                    pesquisador={pesquisador}
                    onFechar={() => setEditando(false)}
                    onSalvar={salvar}
                />
            )}
            {transicao && (
                <ModalTransicaoEstudo
                    estudo={estudo}
                    destino={transicao}
                    onFechar={() => setTransicao(null)}
                    onConfirmar={transicionar}
                    onAtualizar={atualizarEstudo}
                />
            )}
        </section>
    );
}
