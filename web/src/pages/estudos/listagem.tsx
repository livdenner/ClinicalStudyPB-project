import { useEffect, useState } from "react";
import { Button, toast } from "@heroui/react";
import { Plus } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BuscaFiltroEstudos } from "../../components/estudos/BuscaFiltroEstudos";
import { TabelaEstudos } from "../../components/estudos/TabelaEstudos";
import { ModalNovoEstudo } from "../../components/estudos/ModalNovoEstudo";
import { ModalEditarEstudo } from "../../components/estudos/ModalEditarEstudo";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { ApiClientError } from "../../services/api/apiClient";
import { cadastrarEstudo, editarEstudo, listarEstudos } from "../../services/estudos";
import type { AuthenticatedUser } from "../../types/auth";
import type { DadosEstudoApi, EstudoApi } from "../../types/estudo";
import { filtrarEstudos } from "../../utils/estudos";

export function ListagemEstudosPage() {
    const { session } = useAuth();
    if (!session) return <Navigate to="/login" replace />;
    if (session.user.role !== "RESEARCHER") {
        return (
            <section className="py-12 text-center">
                <h1 className="text-2xl font-bold text-[var(--color-title)]">Acesso restrito</h1>
                <p className="my-4">
                    A gestão de estudos está disponível apenas para pesquisadores.
                </p>
                {session.user.role === "ADMINISTRATOR" && (
                    <Link className="text-[var(--color-primary)] underline" to="/usuarios">
                        Ir para usuários e acessos
                    </Link>
                )}
            </section>
        );
    }
    return (
        <GestaoEstudos
            key={session.accessToken}
            token={session.accessToken}
            pesquisador={session.user}
        />
    );
}

function GestaoEstudos({ token, pesquisador }: { token: string; pesquisador: AuthenticatedUser }) {
    const [estudos, setEstudos] = useState<EstudoApi[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [modal, setModal] = useState<{ estudo?: EstudoApi } | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        listarEstudos(token, controller.signal)
            .then((dados) => {
                if (!controller.signal.aborted) setEstudos(dados);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                if (error instanceof ApiClientError && error.status === 401) {
                    setErro("Sua sessão não é mais válida. Entre novamente para continuar.");
                } else if (error instanceof ApiClientError && error.status === 403) {
                    setErro("Você não tem permissão para consultar estudos.");
                } else {
                    setErro(
                        "Não foi possível carregar os estudos. Verifique a conexão e tente novamente."
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [token, tentativa]);

    async function cadastrar(dados: DadosEstudoApi) {
        const novo = await cadastrarEstudo({ ...dados, responsibleUserId: pesquisador.id }, token);
        setEstudos((atuais) => [...atuais, novo]);
        setModal(null);
        toast.success("Estudo cadastrado com sucesso.");
    }

    async function salvar(dados: DadosEstudoApi) {
        const editando = modal?.estudo;
        if (!editando) return;
        const atualizado = await editarEstudo(
            editando.id,
            {
                ...dados,
                responsibleUserId: editando.responsibleUserId,
            },
            token
        );
        setEstudos((atuais) =>
            atuais.map((estudo) => (estudo.id === atualizado.id ? atualizado : estudo))
        );
        setModal(null);
        toast.success("Estudo atualizado com sucesso.");
    }

    const filtrados = filtrarEstudos(estudos, busca);

    return (
        <section className="flex flex-col gap-6" aria-labelledby="studies-heading">
            <header className="flex items-center justify-between gap-5 max-[760px]:flex-col max-[760px]:items-start">
                <div>
                    <h1
                        id="studies-heading"
                        className="text-[28px] font-bold tracking-tight text-[var(--color-title)]"
                    >
                        Estudos clínicos
                    </h1>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                        Gerencie os dados e responsáveis dos estudos.
                    </p>
                </div>
                <Button
                    variant="primary"
                    isDisabled={carregando || Boolean(erro)}
                    onPress={() => setModal({})}
                >
                    <Plus aria-hidden="true" size={20} /> Novo estudo
                </Button>
            </header>
            <section
                className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
                aria-labelledby="all-studies-heading"
            >
                <div className="flex items-center justify-between gap-5 border-b border-[var(--color-border)] px-5 py-4 max-[900px]:flex-col max-[900px]:items-stretch">
                    <div>
                        <h2
                            id="all-studies-heading"
                            className="text-base font-bold text-[var(--color-title)]"
                        >
                            Todos os estudos
                        </h2>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                            Visão geral dos estudos cadastrados
                        </p>
                    </div>
                    <BuscaFiltroEstudos busca={busca} aoMudarBusca={setBusca} />
                </div>
                {carregando ? (
                    <p role="status" className="p-8 text-center">
                        Carregando estudos...
                    </p>
                ) : erro ? (
                    <div className="flex flex-col items-center gap-3 p-8 text-center">
                        <ErrorMessage message={erro} />
                        <Button
                            variant="secondary"
                            onPress={() => {
                                setCarregando(true);
                                setErro("");
                                setTentativa((atual) => atual + 1);
                            }}
                        >
                            Tentar novamente
                        </Button>
                        <Link className="text-[var(--color-primary)] underline" to="/login">
                            Ir para o login
                        </Link>
                    </div>
                ) : (
                    <>
                        <TabelaEstudos
                            estudos={filtrados}
                            pesquisador={pesquisador}
                            onEditar={(estudo) => setModal({ estudo })}
                        />
                        <footer className="border-t border-[var(--color-border)] px-5 py-4 text-xs text-[var(--color-muted)]">
                            Exibindo {filtrados.length} de {estudos.length} estudos
                        </footer>
                    </>
                )}
            </section>
            {modal &&
                (modal.estudo ? (
                    <ModalEditarEstudo
                        estudo={modal.estudo}
                        pesquisador={pesquisador}
                        onFechar={() => setModal(null)}
                        onSalvar={salvar}
                    />
                ) : (
                    <ModalNovoEstudo
                        pesquisador={pesquisador}
                        onFechar={() => setModal(null)}
                        onCadastrar={cadastrar}
                    />
                ))}
        </section>
    );
}
