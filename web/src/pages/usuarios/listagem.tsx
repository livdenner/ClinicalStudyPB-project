import { useEffect, useState } from "react";
import { Button, toast } from "@heroui/react";
import { Plus } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ModalUsuario } from "../../components/usuarios/ModalUsuario";
import { BuscaFiltroUsuarios } from "../../components/usuarios/BuscaFiltroUsuarios";
import { TabelaUsuarios } from "../../components/usuarios/TabelaUsuarios";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { ApiClientError } from "../../services/api/apiClient";
import {
    alterarSituacaoUsuario,
    cadastrarUsuario,
    editarUsuario,
    listarUsuarios,
} from "../../services/usuarios";
import type { UserRole } from "../../types/auth";
import type { DadosCadastroUsuario, FiltroSituacaoUsuario, Usuario } from "../../types/usuario";

export function ListagemUsuariosPage() {
    const { session } = useAuth();
    if (!session) return <Navigate to="/login" replace />;
    if (session.user.role !== "ADMINISTRATOR") {
        return (
            <section className="py-12 text-center">
                <h1 className="text-2xl font-bold text-[var(--color-title)]">Acesso restrito</h1>
                <p className="my-4">
                    A gestão de usuários está disponível apenas para administradores.
                </p>
                <Link className="text-[var(--color-primary)] underline" to="/estudos">
                    Voltar para estudos
                </Link>
            </section>
        );
    }
    return <GestaoUsuarios key={session.accessToken} token={session.accessToken} />;
}

function GestaoUsuarios({ token }: { token: string }) {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [perfil, setPerfil] = useState<UserRole | "">("");
    const [situacao, setSituacao] = useState<FiltroSituacaoUsuario>("");
    const [modal, setModal] = useState<{ usuario?: Usuario } | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        listarUsuarios(token, controller.signal)
            .then((dados) => {
                if (!controller.signal.aborted) setUsuarios(dados);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                if (error instanceof ApiClientError && error.status === 401) {
                    setErro("Sua sessão não é mais válida. Entre novamente para continuar.");
                } else if (error instanceof ApiClientError && error.status === 403) {
                    setErro("Você não tem permissão para consultar usuários.");
                } else {
                    setErro(
                        "Não foi possível carregar os usuários. Verifique a conexão e tente novamente."
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [token, tentativa]);

    async function salvar(dados: DadosCadastroUsuario, ativo?: boolean) {
        const editando = modal?.usuario;
        if (!editando) {
            const novo = await cadastrarUsuario(dados, token);
            setUsuarios((atuais) => [...atuais, novo]);
            setModal(null);
            toast.success("Usuário cadastrado com sucesso.");
            return;
        }
        const mudouSituacao = ativo !== undefined && ativo !== editando.active;
        const mudouDados =
            dados.name !== editando.name ||
            dados.email !== editando.email ||
            dados.role !== editando.role;
        let atualizado = editando;
        if (!mudouSituacao || mudouDados) {
            atualizado = await editarUsuario(
                editando.id,
                { name: dados.name, email: dados.email, role: dados.role },
                token
            );
        }
        if (mudouSituacao) {
            if (mudouDados) {
                const dadosSalvos = atualizado;
                setUsuarios((atuais) =>
                    atuais.map((usuario) => (usuario.id === dadosSalvos.id ? dadosSalvos : usuario))
                );
                setModal({ usuario: dadosSalvos });
            }
            try {
                atualizado = await alterarSituacaoUsuario(editando.id, ativo, token);
            } catch (error) {
                if (!mudouDados) throw error;
                throw new ApiClientError(
                    "Os dados do usuário foram salvos, mas não foi possível confirmar a alteração da situação. Tente salvar novamente.",
                    {
                        status: error instanceof ApiClientError ? error.status : null,
                        code: "PARTIAL_UPDATE",
                    }
                );
            }
        }
        setUsuarios((atuais) =>
            atuais.map((usuario) => (usuario.id === atualizado.id ? atualizado : usuario))
        );
        setModal(null);
        toast.success("Usuário atualizado com sucesso.");
    }

    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const filtrados = usuarios.filter(
        (usuario) =>
            (!termo ||
                `${usuario.name} ${usuario.email}`.toLocaleLowerCase("pt-BR").includes(termo)) &&
            (!perfil || usuario.role === perfil) &&
            (!situacao || usuario.active === (situacao === "ativo"))
    );

    return (
        <section className="flex flex-col gap-6" aria-labelledby="usuarios-heading">
            <header className="flex items-center justify-between gap-5 max-[760px]:flex-col max-[760px]:items-start">
                <div>
                    <h1
                        id="usuarios-heading"
                        className="text-[28px] font-bold tracking-tight text-[var(--color-title)]"
                    >
                        Usuários e acessos
                    </h1>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                        Gerencie os usuários e seus perfis de acesso.
                    </p>
                </div>
                <Button variant="primary" onPress={() => setModal({})}>
                    <Plus aria-hidden="true" size={20} /> Novo usuário
                </Button>
            </header>
            <section
                className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
                aria-labelledby="lista-usuarios-heading"
            >
                <div className="flex flex-col gap-4 border-b border-[var(--color-border)] p-5">
                    <h2 id="lista-usuarios-heading" className="font-bold text-[var(--color-title)]">
                        Todos os usuários
                    </h2>
                    <BuscaFiltroUsuarios
                        busca={busca}
                        perfil={perfil}
                        situacao={situacao}
                        aoMudarBusca={setBusca}
                        aoMudarPerfil={setPerfil}
                        aoMudarSituacao={setSituacao}
                    />
                </div>
                {carregando ? (
                    <p role="status" className="p-8 text-center">
                        Carregando usuários...
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
                        <TabelaUsuarios
                            usuarios={filtrados}
                            onEditar={(usuario) => setModal({ usuario })}
                        />
                        <footer className="border-t border-[var(--color-border)] px-5 py-4 text-xs text-[var(--color-muted)]">
                            Exibindo {filtrados.length} de {usuarios.length} usuários
                        </footer>
                    </>
                )}
            </section>
            {modal && (
                <ModalUsuario
                    usuario={modal.usuario}
                    onFechar={() => setModal(null)}
                    onSalvar={salvar}
                />
            )}
        </section>
    );
}
