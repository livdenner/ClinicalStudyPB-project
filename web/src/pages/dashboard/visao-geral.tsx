import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { PrototipoStats, usePrototipos } from "../../context/PrototiposContext";
import { canRoleAccessPath } from "../../config/navigation";

export function VisaoGeralPage() {
  const { studies, candidates, participants, visits } = usePrototipos();
  const { user } = useAuth();
  const navigate = useNavigate();

  const podeAcessarEstudos = user
    ? canRoleAccessPath(user.role, "/estudos")
    : false;
  const podeAcessarRecrutamento = user
    ? canRoleAccessPath(user.role, "/recrutamento")
    : false;
  const podeAcessarVisitas = user
    ? canRoleAccessPath(user.role, "/visitas")
    : false;

  const avaliacoesPendentes = candidates.filter(
    (c) => c.status === "Pendente",
  ).length;
  const visitasPendentes = visits.filter((v) => v.status === "Pendente").length;

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="dashboard-heading"
    >
      <header className="flex items-center justify-between gap-5 max-[760px]:flex-col max-[760px]:items-start">
        <div>
          <h1
            id="dashboard-heading"
            className="text-[28px] font-bold tracking-tight text-[var(--color-title)]"
          >
            Visão geral (Protótipo)
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Acompanhe os principais indicadores e pendências dos estudos.
          </p>
        </div>
      </header>

      <PrototipoStats
        items={[
          {
            label: "Estudos ativos",
            value: studies.filter((s) => s.status !== "Encerrado").length,
          },
          {
            label: "Em recrutamento",
            value: studies.filter((s) => s.status === "Recrutamento").length,
            tone: "amber",
          },
          {
            label: "Participantes",
            value: participants.length,
            tone: "blue",
          },
          {
            label: "Visitas pendentes",
            value: visits.filter((v) => v.status !== "Realizada").length,
            tone: "green",
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <section
          className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-5"
          aria-labelledby="progresso-estudos-heading"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2
                id="progresso-estudos-heading"
                className="text-base font-bold text-[var(--color-title)]"
              >
                Progresso dos estudos
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Participantes em relação ao limite previsto
              </p>
            </div>
            {podeAcessarEstudos && (
              <button
                type="button"
                onClick={() => navigate("/estudos")}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
              >
                Ver todos
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {studies.slice(0, 3).map((study) => {
              const percentual = Math.min(
                100,
                Math.round((study.participants / study.limit) * 100),
              );
              return (
                <button
                  key={study.id}
                  type="button"
                  onClick={() => {
                    if (podeAcessarEstudos) navigate("/estudos");
                  }}
                  className={`flex flex-col gap-2 rounded-lg border border-[#e2e8f0] p-3.5 text-left transition ${
                    podeAcessarEstudos
                      ? "cursor-pointer hover:border-[var(--color-primary)] hover:bg-slate-50"
                      : "cursor-default"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <strong className="font-semibold text-[var(--color-title)]">
                      {study.title}
                    </strong>
                    <span className="text-xs font-medium text-[var(--color-muted)]">
                      {study.participants} de {study.limit}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-5"
          aria-labelledby="pendencias-heading"
        >
          <div className="mb-4">
            <h2
              id="pendencias-heading"
              className="text-base font-bold text-[var(--color-title)]"
            >
              Pendências
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Itens que precisam de atenção
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                if (podeAcessarRecrutamento) navigate("/recrutamento");
              }}
              className={`flex items-center justify-between gap-3 rounded-lg border border-[#e2e8f0] p-3.5 text-left transition ${
                podeAcessarRecrutamento
                  ? "cursor-pointer hover:border-[var(--color-primary)] hover:bg-slate-50"
                  : "cursor-default"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#d97706]"
                  aria-hidden="true"
                />
                <div>
                  <strong className="block text-sm font-semibold text-[var(--color-title)]">
                    {avaliacoesPendentes} avaliações de elegibilidade
                  </strong>
                  <p className="text-xs text-[var(--color-muted)]">
                    Aguardando registro
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="text-[var(--color-muted)]"
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={() => {
                if (podeAcessarVisitas) navigate("/visitas");
              }}
              className={`flex items-center justify-between gap-3 rounded-lg border border-[#e2e8f0] p-3.5 text-left transition ${
                podeAcessarVisitas
                  ? "cursor-pointer hover:border-[var(--color-primary)] hover:bg-slate-50"
                  : "cursor-default"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2563B8]"
                  aria-hidden="true"
                />
                <div>
                  <strong className="block text-sm font-semibold text-[var(--color-title)]">
                    {visitasPendentes} visita pendente
                  </strong>
                  <p className="text-xs text-[var(--color-muted)]">
                    Acompanhamento a registrar
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="text-[var(--color-muted)]"
                aria-hidden="true"
              />
            </button>
          </div>
        </section>
      </div>

      <section
        className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-5"
        aria-labelledby="atividades-recentes-heading"
      >
        <div className="mb-4">
          <h2
            id="atividades-recentes-heading"
            className="text-base font-bold text-[var(--color-title)]"
          >
            Atividades recentes
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Últimas movimentações do ambiente demonstrativo
          </p>
        </div>

        <div className="flex flex-col divide-y divide-[#e2e8f0] text-sm text-[var(--color-text)]">
          <p className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="min-w-[110px] text-xs font-semibold text-[var(--color-muted)]">
              Hoje, 09:42
            </span>
            Avaliação do Candidato 021 registrada
          </p>
          <p className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="min-w-[110px] text-xs font-semibold text-[var(--color-muted)]">
              Ontem, 16:10
            </span>
            Visita do Participante 001 agendada
          </p>
          <p className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="min-w-[110px] text-xs font-semibold text-[var(--color-muted)]">
              12 mai, 14:20
            </span>
            Protocolo do estudo cardiovascular revisado
          </p>
        </div>
      </section>
    </section>
  );
}
