import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Plus } from "lucide-react";

import { BuscaFiltroEstudos } from "../../components/estudos/BuscaFiltroEstudos";
import { CardResumoEstudos } from "../../components/estudos/CardResumoEstudos";
import { TabelaEstudos } from "../../components/estudos/TabelaEstudos";
import { ModalNovoEstudo, type DadosNovoEstudo } from "../../components/estudos/ModalNovoEstudo";
import { ModalEditarEstudo } from "../../components/estudos/ModalEditarEstudo";
import { estudosMock } from "../../data/estudos-mock";
import type { Estudo } from "../../types/estudo";
import { contarEstudosPorStatus, filtrarEstudos, type FiltroStatus } from "../../utils/estudos";

export function ListagemEstudosPage() {
    const [estudos, setEstudos] = useState(estudosMock);
    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("Todos os status");

    const [modalAberto, setModalAberto] = useState(false);
    const [estudoEditando, setEstudoEditando] = useState<Estudo | null>(null);

    const estudosFiltrados = useMemo(
        () => filtrarEstudos(estudos, busca, filtroStatus),
        [estudos, busca, filtroStatus]
    );

    function handleCadastrar(novoEstudo: DadosNovoEstudo) {
        setEstudos((atuais) => [...atuais, { ...novoEstudo, id: String(Date.now()) }]);
        setModalAberto(false);
    }

    function handleEditar(estudo: Estudo) {
        setEstudoEditando(estudo);
    }

    function handleSalvar(estudoAtualizado: Estudo) {
        setEstudos((atuais) =>
            atuais.map((e) => (e.id === estudoAtualizado.id ? estudoAtualizado : e))
        );
        setEstudoEditando(null);
    }

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
                        Gerencie protocolos, responsáveis e andamento dos estudos.
                    </p>
                </div>

                <Button variant="primary" onPress={() => setModalAberto(true)}>
                    <Plus aria-hidden="true" strokeWidth={1.7} />
                    Novo estudo
                </Button>
            </header>

            <div
                className="grid grid-cols-4 gap-3.5 max-[1000px]:grid-cols-2 max-[520px]:grid-cols-1"
                aria-label="Resumo dos estudos"
            >
                <CardResumoEstudos
                    titulo="Estudos cadastrados"
                    quantidade={estudos.length}
                    tipo="total"
                />
                <CardResumoEstudos
                    titulo="Em recrutamento"
                    quantidade={contarEstudosPorStatus(estudos, "Recrutamento")}
                    tipo="recrutamento"
                />
                <CardResumoEstudos
                    titulo="Em execução"
                    quantidade={contarEstudosPorStatus(estudos, "Em execução")}
                    tipo="execucao"
                />
                <CardResumoEstudos
                    titulo="Encerrados"
                    quantidade={contarEstudosPorStatus(estudos, "Encerrado")}
                    tipo="encerrado"
                />
            </div>

            <section
                className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
                aria-labelledby="all-studies-heading"
            >
                <div className="flex items-center justify-between gap-5 border-b border-[var(--color-border)] px-5 py-4 max-[900px]:flex-col max-[900px]:items-start">
                    <div>
                        <h2
                            id="all-studies-heading"
                            className="text-base font-bold text-[var(--color-title)]"
                        >
                            Todos os estudos
                        </h2>

                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                            Visão geral dos protocolos cadastrados
                        </p>
                    </div>

                    <BuscaFiltroEstudos
                        busca={busca}
                        filtroStatus={filtroStatus}
                        aoMudarBusca={setBusca}
                        aoMudarStatus={setFiltroStatus}
                    />
                </div>

                <TabelaEstudos estudos={estudosFiltrados} onEditar={handleEditar} />

                <footer className="border-t border-[var(--color-border)] px-5 py-4 text-xs text-[var(--color-muted)]">
                    Exibindo {estudosFiltrados.length}{" "}
                    {estudosFiltrados.length === 1 ? "resultado" : "resultados"}
                </footer>
            </section>

            {modalAberto && (
                <ModalNovoEstudo
                    onFechar={() => setModalAberto(false)}
                    onCadastrar={handleCadastrar}
                />
            )}

            {estudoEditando && (
                <ModalEditarEstudo
                    estudo={estudoEditando}
                    onFechar={() => setEstudoEditando(null)}
                    onSalvar={handleSalvar}
                />
            )}
        </section>
    );
}
