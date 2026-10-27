import { useState, type FormEvent } from "react";
import { ArrowLeft, ChevronRight, Plus, Search } from "lucide-react";
import {
    PrototipoBadge,
    PrototipoEmpty,
    PrototipoModal,
    usePrototipos,
} from "../../context/PrototiposContext";
import type {
    CandidatoPrototipo,
    EstudoPrototipo,
    StatusCandidato,
} from "../../data/prototipos-mock";

const ETAPAS: StatusCandidato[] = ["Pendente", "Elegível", "Não elegível"];

export function RecrutamentoPage() {
    const { studies, candidates, evaluateCandidate, includeCandidate } = usePrototipos();
    const [busca, setBusca] = useState("");
    const [filtro, setFiltro] = useState("Todos");
    const [selecionadoId, setSelecionadoId] = useState<number | null>(null);

    const candidatoSelecionado = selecionadoId
        ? (candidates.find((c) => c.id === selecionadoId) ?? null)
        : null;

    if (candidatoSelecionado) {
        const estudo = studies.find((s) => s.id === candidatoSelecionado.studyId) ?? studies[0];
        return (
            <DetalheCandidato
                candidato={candidatoSelecionado}
                estudo={estudo}
                aoVoltar={() => setSelecionadoId(null)}
                aoAvaliar={evaluateCandidate}
                aoIncluir={(candidato) => {
                    includeCandidate(candidato);
                    setSelecionadoId(null);
                }}
            />
        );
    }

    const filtrados = candidates.filter(
        (c) =>
            c.name.toLowerCase().includes(busca.toLowerCase()) &&
            (filtro === "Todos" || c.status === filtro)
    );

    const pendentesCount = candidates.filter((c) => c.status === "Pendente").length;

    return (
        <section className="flex flex-col gap-6" aria-labelledby="recrutamento-heading">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#dce5ed] bg-gradient-to-r from-[#126966] to-[#1a8a86] p-6 text-white">
                <div>
                    <span className="text-xs font-bold tracking-wider uppercase opacity-85">
                        JORNADA DE RECRUTAMENTO
                    </span>
                    <h1
                        id="recrutamento-heading"
                        className="mt-1 text-[28px] font-bold tracking-tight"
                    >
                        Recrutamento (Protótipo)
                    </h1>
                    <p className="mt-1 text-sm opacity-90">
                        Avalie candidatos e acompanhe cada decisão de elegibilidade.
                    </p>
                </div>

                <div className="flex flex-col items-end rounded-xl bg-white/15 px-4 py-3 backdrop-blur-xs max-[640px]:items-start">
                    <strong className="text-2xl leading-none font-bold">{pendentesCount}</strong>
                    <span className="mt-1 text-xs opacity-90">avaliações aguardando registro</span>
                </div>
            </div>

            <section
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white p-4"
                aria-label="Filtros de candidatos"
            >
                <div className="relative min-w-[240px] flex-1">
                    <Search
                        size={16}
                        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar candidato..."
                        aria-label="Buscar candidato"
                        className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white pr-3 pl-9 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    />
                </div>

                <select
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    aria-label="Filtrar por situação"
                    className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                    <option value="Todos">Todos</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Elegível">Elegível</option>
                    <option value="Não elegível">Não elegível</option>
                </select>
            </section>

            {filtrados.length > 0 ? (
                <div className="grid grid-cols-3 gap-4 max-[960px]:grid-cols-1">
                    {ETAPAS.map((etapa) => {
                        const candidatosEtapa = filtrados.filter((c) => c.status === etapa);
                        const dotColor =
                            etapa === "Pendente"
                                ? "bg-[#d97706]"
                                : etapa === "Elegível"
                                  ? "bg-[#16804B]"
                                  : "bg-[#B42318]";

                        return (
                            <section
                                key={etapa}
                                className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white p-4"
                                aria-label={`Coluna ${etapa}`}
                            >
                                <header className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`h-2.5 w-2.5 rounded-full ${dotColor}`}
                                            aria-hidden="true"
                                        />
                                        <strong className="text-sm font-bold text-[var(--color-title)]">
                                            {etapa}
                                        </strong>
                                    </div>
                                    <span className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-bold text-[var(--color-title)]">
                                        {candidatosEtapa.length}
                                    </span>
                                </header>

                                <div className="flex flex-col gap-2.5">
                                    {candidatosEtapa.map((c) => {
                                        const estudoTitulo =
                                            studies.find((s) => s.id === c.studyId)?.title ?? "";
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => setSelecionadoId(c.id)}
                                                className="flex cursor-pointer flex-col gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3.5 text-left transition hover:border-[var(--color-primary)] hover:bg-white"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-xs font-bold text-[var(--color-primary)]">
                                                            {c.name.slice(-2)}
                                                        </span>
                                                        <div>
                                                            <strong className="block text-sm font-semibold text-[var(--color-title)]">
                                                                {c.name}
                                                            </strong>
                                                            <small className="text-xs text-[var(--color-muted)]">
                                                                {c.age} anos
                                                            </small>
                                                        </div>
                                                    </div>
                                                    <ChevronRight
                                                        size={16}
                                                        className="text-[var(--color-muted)]"
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                                <p className="text-xs font-semibold text-[var(--color-primary)]">
                                                    {estudoTitulo}
                                                </p>
                                                <small className="line-clamp-2 text-xs text-[var(--color-muted)]">
                                                    {c.notes}
                                                </small>
                                            </button>
                                        );
                                    })}

                                    {candidatosEtapa.length === 0 && (
                                        <div className="rounded-lg border border-dashed border-[#cbd5e1] py-8 text-center text-xs text-[var(--color-muted)]">
                                            Nenhum candidato nesta etapa
                                        </div>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            ) : (
                <section className="rounded-xl border border-[var(--color-border)] bg-white">
                    <PrototipoEmpty text="Nenhum candidato corresponde aos filtros selecionados." />
                </section>
            )}
        </section>
    );
}

function DetalheCandidato({
    candidato,
    estudo,
    aoVoltar,
    aoAvaliar,
    aoIncluir,
}: {
    candidato: CandidatoPrototipo;
    estudo: EstudoPrototipo;
    aoVoltar: () => void;
    aoAvaliar: (id: number, status: StatusCandidato, notes: string) => void;
    aoIncluir: (candidato: CandidatoPrototipo) => void;
}) {
    const [modalAvaliacao, setModalAvaliacao] = useState(false);
    const [modalConfirmacao, setModalConfirmacao] = useState(false);

    function handleSubmitAvaliacao(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const status = formData.get("status") as StatusCandidato;
        const notes = String(formData.get("notes") || "");
        aoAvaliar(candidato.id, status, notes);
        setModalAvaliacao(false);
    }

    return (
        <section className="flex flex-col gap-6">
            <div>
                <button
                    type="button"
                    onClick={aoVoltar}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Voltar para candidatos
                </button>
            </div>

            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-[28px] font-bold tracking-tight text-[var(--color-title)]">
                        {candidato.name}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                        Candidato vinculado a {estudo.title}
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    {candidato.status === "Elegível" ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setModalAvaliacao(true)}
                                className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-title)] hover:bg-slate-50"
                            >
                                Registrar avaliação
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalConfirmacao(true)}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                            >
                                <Plus size={16} aria-hidden="true" />
                                Incluir no estudo
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setModalAvaliacao(true)}
                            className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                        >
                            Registrar avaliação
                        </button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-2 gap-5 max-[800px]:grid-cols-1">
                <section className="rounded-xl border border-[var(--color-border)] bg-white p-5">
                    <h2 className="mb-4 text-base font-bold text-[var(--color-title)]">
                        Informações essenciais
                    </h2>
                    <dl className="grid grid-cols-[160px_1fr] gap-y-2.5 text-sm">
                        <dt className="text-[var(--color-muted)]">Identificação fictícia</dt>
                        <dd className="font-semibold text-[var(--color-title)]">
                            {candidato.name}
                        </dd>
                        <dt className="text-[var(--color-muted)]">Idade informada</dt>
                        <dd className="font-semibold text-[var(--color-title)]">
                            {candidato.age} anos
                        </dd>
                        <dt className="text-[var(--color-muted)]">Estudo</dt>
                        <dd className="font-semibold text-[var(--color-title)]">{estudo.title}</dd>
                    </dl>
                </section>

                <section className="rounded-xl border border-[var(--color-border)] bg-white p-5">
                    <h2 className="mb-3 text-base font-bold text-[var(--color-title)]">
                        Situação da avaliação
                    </h2>
                    <PrototipoBadge>{candidato.status}</PrototipoBadge>
                    <p className="mt-3 text-sm text-[var(--color-text)]">{candidato.notes}</p>
                </section>
            </div>

            <section className="rounded-xl border border-[var(--color-border)] bg-white p-5">
                <h2 className="text-base font-bold text-[var(--color-title)]">
                    Critérios de elegibilidade
                </h2>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Os critérios abaixo representam somente a confirmação dos itens definidos no
                    protocolo, sem decisão clínica automatizada.
                </p>

                <div className="mt-4 flex flex-col gap-2.5 text-sm text-[var(--color-text)]">
                    <label className="flex items-center gap-2.5">
                        <input
                            type="checkbox"
                            defaultChecked={candidato.status === "Elegível"}
                            className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                        Informações obrigatórias do protocolo conferidas
                    </label>
                    <label className="flex items-center gap-2.5">
                        <input
                            type="checkbox"
                            defaultChecked={candidato.status === "Elegível"}
                            className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                        Critérios documentados marcados como atendidos pelo avaliador
                    </label>
                    <label className="flex items-center gap-2.5">
                        <input
                            type="checkbox"
                            defaultChecked={candidato.status !== "Pendente"}
                            className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                        Avaliação revisada por profissional responsável
                    </label>
                </div>
            </section>

            {modalAvaliacao && (
                <PrototipoModal
                    title="Registrar avaliação"
                    subtitle="A decisão é informada pelo avaliador responsável."
                    onClose={() => setModalAvaliacao(false)}
                >
                    <form onSubmit={handleSubmitAvaliacao} className="flex flex-col gap-4">
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
                            <span>
                                Resultado da avaliação <b className="text-[#b91c1c]">*</b>
                            </span>
                            <select
                                name="status"
                                defaultValue={candidato.status}
                                className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)]"
                            >
                                <option value="Elegível">Elegível</option>
                                <option value="Não elegível">Não elegível</option>
                                <option value="Pendente">Pendente</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
                            <span>
                                Observações <b className="text-[#b91c1c]">*</b>
                            </span>
                            <textarea
                                name="notes"
                                defaultValue={candidato.notes}
                                required
                                rows={3}
                                className="rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-text)]"
                            />
                        </label>

                        <div className="rounded-lg bg-[#f1f5f9] p-3 text-xs text-[var(--color-muted)]">
                            Este registro não substitui avaliação clínica e não toma decisões
                            automaticamente.
                        </div>

                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setModalAvaliacao(false)}
                                className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-title)] hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                            >
                                Salvar avaliação
                            </button>
                        </div>
                    </form>
                </PrototipoModal>
            )}

            {modalConfirmacao && (
                <PrototipoModal
                    title="Confirmar inclusão"
                    subtitle="O candidato será criado como participante deste estudo."
                    onClose={() => setModalConfirmacao(false)}
                >
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-[var(--color-text)]">
                            Incluir <strong>{candidato.name}</strong> em{" "}
                            <strong>{estudo.title}</strong>?
                        </p>
                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setModalConfirmacao(false)}
                                className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-title)] hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    aoIncluir(candidato);
                                    setModalConfirmacao(false);
                                }}
                                className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                            >
                                Confirmar inclusão
                            </button>
                        </div>
                    </div>
                </PrototipoModal>
            )}
        </section>
    );
}
