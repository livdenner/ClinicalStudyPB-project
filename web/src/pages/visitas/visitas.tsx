import { useState, type FormEvent } from "react";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import {
  PrototipoBadge,
  PrototipoEmpty,
  PrototipoModal,
  usePrototipos,
} from "../../context/PrototiposContext";
import {
  formatarDataPrototipo,
  type EstudoPrototipo,
  type ParticipantePrototipo,
  type VisitaPrototipo,
} from "../../data/prototipos-mock";

export function VisitasPage() {
  const { studies, participants, visits, addVisit, completeVisit } =
    usePrototipos();
  const [modalAgendar, setModalAgendar] = useState(false);
  const [modalRegistrar, setModalRegistrar] = useState(false);
  const [estudoFiltro, setEstudoFiltro] = useState("Todos");
  const [statusFiltro, setStatusFiltro] = useState("Todos");
  const [visitaSelecionadaId, setVisitaSelecionadaId] = useState<number | null>(
    null,
  );

  const visitaSelecionada = visitaSelecionadaId
    ? visits.find((v) => v.id === visitaSelecionadaId) ?? null
    : null;

  if (visitaSelecionada) {
    const participante = participants.find(
      (p) => p.id === visitaSelecionada.participantId,
    );
    const estudo = studies.find((s) => s.id === visitaSelecionada.studyId);

    return (
      <section className="flex flex-col gap-6">
        <div>
          <button
            type="button"
            onClick={() => setVisitaSelecionadaId(null)}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar para visitas
          </button>
        </div>

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[var(--color-title)]">
              {visitaSelecionada.type}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {participante?.name} ·{" "}
              {formatarDataPrototipo(visitaSelecionada.date)}
            </p>
          </div>

          {visitaSelecionada.status !== "Realizada" && (
            <button
              type="button"
              onClick={() => setModalRegistrar(true)}
              className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              Registrar acompanhamento
            </button>
          )}
        </header>

        <div className="grid grid-cols-2 gap-5 max-[800px]:grid-cols-1">
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-5">
            <h2 className="mb-4 text-base font-bold text-[var(--color-title)]">
              Detalhes da visita
            </h2>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2.5 text-sm">
              <dt className="text-[var(--color-muted)]">Participante</dt>
              <dd className="font-semibold text-[var(--color-title)]">
                {participante?.name}
              </dd>
              <dt className="text-[var(--color-muted)]">Estudo</dt>
              <dd className="font-semibold text-[var(--color-title)]">
                {estudo?.title}
              </dd>
              <dt className="text-[var(--color-muted)]">Data</dt>
              <dd className="font-semibold text-[var(--color-title)]">
                {formatarDataPrototipo(visitaSelecionada.date)}
              </dd>
              <dt className="text-[var(--color-muted)]">Situação</dt>
              <dd>
                <PrototipoBadge>{visitaSelecionada.status}</PrototipoBadge>
              </dd>
            </dl>
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-[var(--color-title)]">
              Registro de acompanhamento
            </h2>
            <p className="text-sm text-[var(--color-text)]">
              {visitaSelecionada.notes ||
                "O acompanhamento ainda não foi registrado."}
            </p>
          </section>
        </div>

        {modalRegistrar && (
          <PrototipoModal
            title="Registrar acompanhamento"
            subtitle="Registre somente as informações previstas no protocolo."
            onClose={() => setModalRegistrar(false)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                completeVisit(
                  visitaSelecionada.id,
                  String(formData.get("notes") || ""),
                );
                setModalRegistrar(false);
              }}
              className="flex flex-col gap-4"
            >
              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
                <span>
                  Resumo do acompanhamento <b className="text-[#b91c1c]">*</b>
                </span>
                <textarea
                  name="notes"
                  required
                  rows={4}
                  placeholder="Descreva o registro da visita..."
                  className="rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-text)]"
                />
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalRegistrar(false)}
                  className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-title)] hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  Salvar registro
                </button>
              </div>
            </form>
          </PrototipoModal>
        )}
      </section>
    );
  }

  const filtradas = visits.filter(
    (v) =>
      (estudoFiltro === "Todos" || String(v.studyId) === estudoFiltro) &&
      (statusFiltro === "Todos" || v.status === statusFiltro),
  );
  const ordenadas = [...filtradas].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section className="flex flex-col gap-6" aria-labelledby="visitas-heading">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#dce5ed] bg-gradient-to-r from-[#1b2d40] to-[#29435c] p-6 text-white">
        <div>
          <span className="text-xs font-bold tracking-wider uppercase opacity-80">
            AGENDA DE ACOMPANHAMENTO
          </span>
          <h1
            id="visitas-heading"
            className="mt-1 text-[28px] font-bold tracking-tight"
          >
            Visitas (Protótipo)
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Organize compromissos e registre o acompanhamento dos participantes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAgendar(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
        >
          <Plus size={18} aria-hidden="true" />
          Agendar visita
        </button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-5 max-[900px]:grid-cols-1">
        <aside className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5">
          <h2 className="text-base font-bold text-[var(--color-title)]">
            Filtrar agenda
          </h2>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
            <span>Estudo</span>
            <select
              value={estudoFiltro}
              onChange={(e) => setEstudoFiltro(e.target.value)}
              className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)]"
            >
              <option value="Todos">Todos</option>
              {studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
            <span>Situação</span>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)]"
            >
              <option value="Todos">Todos</option>
              <option value="Agendada">Agendada</option>
              <option value="Pendente">Pendente</option>
              <option value="Realizada">Realizada</option>
            </select>
          </label>

          <div className="mt-2 flex flex-col gap-2 border-t border-[#e2e8f0] pt-4 text-xs font-medium text-[var(--color-muted)]">
            <span className="flex items-center gap-2">
              <i className="h-2.5 w-2.5 rounded-full bg-[#2563B8]" />
              {visits.filter((v) => v.status === "Agendada").length} agendadas
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2.5 w-2.5 rounded-full bg-[#d97706]" />
              {visits.filter((v) => v.status === "Pendente").length} pendentes
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2.5 w-2.5 rounded-full bg-[#16804B]" />
              {visits.filter((v) => v.status === "Realizada").length} realizadas
            </span>
          </div>
        </aside>

        <section className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between border-b border-[#e2e8f0] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--color-title)]">
                Próximos registros
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Agenda cronológica do período selecionado
              </p>
            </div>
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-bold text-[var(--color-title)]">
              {ordenadas.length} visitas
            </span>
          </div>

          {ordenadas.length > 0 ? (
            <div className="flex flex-col gap-3">
              {ordenadas.map((v) => {
                const d = new Date(`${v.date}T12:00:00`);
                const participanteNome =
                  participants.find((p) => p.id === v.participantId)?.name ??
                  "";
                const estudoTitulo =
                  studies.find((s) => s.id === v.studyId)?.title ?? "";

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVisitaSelecionadaId(v.id)}
                    className="flex cursor-pointer items-center gap-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-left transition hover:border-[var(--color-primary)] hover:bg-white"
                  >
                    <div className="flex min-w-[54px] flex-col items-center justify-center rounded-lg bg-white px-2.5 py-2 text-center shadow-2xs">
                      <strong className="text-lg leading-none font-bold text-[var(--color-title)]">
                        {d.getDate()}
                      </strong>
                      <span className="mt-1 text-[11px] font-semibold uppercase text-[var(--color-muted)]">
                        {d
                          .toLocaleDateString("pt-BR", { month: "short" })
                          .replace(".", "")}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <PrototipoBadge>{v.status}</PrototipoBadge>
                        <small className="text-xs font-medium text-[var(--color-muted)]">
                          {v.type}
                        </small>
                      </div>
                      <h3 className="text-sm font-bold text-[var(--color-title)]">
                        {participanteNome}
                      </h3>
                      <p className="text-xs text-[var(--color-muted)]">
                        {estudoTitulo}
                      </p>
                    </div>

                    <ChevronRight
                      size={18}
                      className="shrink-0 text-[var(--color-muted)]"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <PrototipoEmpty text="Não há visitas para os filtros selecionados." />
          )}
        </section>
      </div>

      {modalAgendar && (
        <ModalAgendarVisita
          studies={studies}
          participants={participants}
          aoFechar={() => setModalAgendar(false)}
          aoSalvar={addVisit}
        />
      )}
    </section>
  );
}

function ModalAgendarVisita({
  studies,
  participants,
  aoFechar,
  aoSalvar,
}: {
  studies: EstudoPrototipo[];
  participants: ParticipantePrototipo[];
  aoFechar: () => void;
  aoSalvar: (visita: Omit<VisitaPrototipo, "id">) => void;
}) {
  const [studyId, setStudyId] = useState<number>(studies[0]?.id ?? 1);
  const participantesEstudo = participants.filter(
    (p) => p.studyId === studyId,
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    aoSalvar({
      studyId,
      participantId: Number(formData.get("participant")),
      date: String(formData.get("date")),
      type: String(formData.get("type")),
      status: "Agendada",
    });
    aoFechar();
  }

  return (
    <PrototipoModal
      title="Agendar visita"
      subtitle="Vincule a visita a um estudo e participante."
      onClose={aoFechar}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
          <span>
            Estudo <b className="text-[#b91c1c]">*</b>
          </span>
          <select
            value={studyId}
            onChange={(e) => setStudyId(Number(e.target.value))}
            className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)]"
          >
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
          <span>
            Participante <b className="text-[#b91c1c]">*</b>
          </span>
          <select
            name="participant"
            required
            className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)]"
          >
            {participantesEstudo.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3 max-[540px]:grid-cols-1">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
            <span>
              Data <b className="text-[#b91c1c]">*</b>
            </span>
            <input
              name="date"
              type="date"
              required
              defaultValue="2026-05-25"
              className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)]"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
            <span>
              Tipo <b className="text-[#b91c1c]">*</b>
            </span>
            <select
              name="type"
              className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)]"
            >
              <option value="Visita de acompanhamento">
                Visita de acompanhamento
              </option>
              <option value="Avaliação inicial">Avaliação inicial</option>
              <option value="Visita de encerramento">
                Visita de encerramento
              </option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={aoFechar}
            className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-title)] hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
          >
            Agendar visita
          </button>
        </div>
      </form>
    </PrototipoModal>
  );
}
