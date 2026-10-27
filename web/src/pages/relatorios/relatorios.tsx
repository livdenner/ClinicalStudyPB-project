import { useState } from "react";
import { Download } from "lucide-react";
import {
  PrototipoBadge,
  PrototipoStats,
  usePrototipos,
} from "../../context/PrototiposContext";

export function RelatoriosPage() {
  const { studies, candidates, participants, visits, flash } = usePrototipos();
  const [estudoId, setEstudoId] = useState("Todos");
  const [periodoInicial, setPeriodoInicial] = useState("2026-01-01");
  const [periodoFinal, setPeriodoFinal] = useState("2026-12-31");

  const cs =
    estudoId === "Todos"
      ? candidates
      : candidates.filter((c) => String(c.studyId) === estudoId);
  const ps =
    estudoId === "Todos"
      ? participants
      : participants.filter((p) => String(p.studyId) === estudoId);
  const vs =
    estudoId === "Todos"
      ? visits
      : visits.filter((v) => String(v.studyId) === estudoId);

  const elegiveisCount = cs.filter((c) => c.status === "Elegível").length;
  const elegiveisPercent = cs.length
    ? Math.round((elegiveisCount / cs.length) * 100)
    : 0;
  const incluidosPercent = Math.min(
    100,
    Math.round((ps.length / Math.max(cs.length, 1)) * 100),
  );

  function exportarCsv() {
    const content = `Indicador,Total\nCandidatos,${cs.length}\nParticipantes,${ps.length}\nVisitas realizadas,${vs.filter((v) => v.status === "Realizada").length}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    a.download = "relatorio-simulado.csv";
    a.click();
    flash("Exportação simulada gerada localmente.");
  }

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="relatorios-heading"
    >
      <header className="flex items-center justify-between gap-5 max-[760px]:flex-col max-[760px]:items-start">
        <div>
          <h1
            id="relatorios-heading"
            className="text-[28px] font-bold tracking-tight text-[var(--color-title)]"
          >
            Relatórios (Protótipo)
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Analise indicadores de recrutamento, inclusão e acompanhamento.
          </p>
        </div>

        <button
          type="button"
          onClick={exportarCsv}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-title)] hover:bg-slate-50"
        >
          <Download size={16} aria-hidden="true" />
          Exportar CSV
        </button>
      </header>

      <section
        className="grid grid-cols-3 gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5 max-[800px]:grid-cols-1"
        aria-label="Filtros do relatório"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
          <span>Estudo</span>
          <select
            value={estudoId}
            onChange={(e) => setEstudoId(e.target.value)}
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
          <span>Período inicial</span>
          <input
            type="date"
            value={periodoInicial}
            onChange={(e) => setPeriodoInicial(e.target.value)}
            className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)]"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-title)]">
          <span>Período final</span>
          <input
            type="date"
            value={periodoFinal}
            onChange={(e) => setPeriodoFinal(e.target.value)}
            className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)]"
          />
        </label>
      </section>

      <PrototipoStats
        items={[
          {
            label: "Candidatos avaliados",
            value: cs.filter((c) => c.status !== "Pendente").length,
          },
          {
            label: "Inclusões",
            value: ps.length,
            tone: "amber",
          },
          {
            label: "Visitas realizadas",
            value: vs.filter((v) => v.status === "Realizada").length,
            tone: "blue",
          },
          {
            label: "Visitas programadas",
            value: vs.filter((v) => v.status !== "Realizada").length,
            tone: "green",
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-5 max-[800px]:grid-cols-1">
        <section className="rounded-xl border border-[var(--color-border)] bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-[var(--color-title)]">
            Funil de recrutamento
          </h2>

          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-[100px_1fr_36px] items-center gap-3 text-sm">
              <span className="text-[var(--color-muted)]">Candidatos</span>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)]"
                  style={{ width: "100%" }}
                />
              </div>
              <b className="text-right text-[var(--color-title)]">
                {cs.length}
              </b>
            </div>

            <div className="grid grid-cols-[100px_1fr_36px] items-center gap-3 text-sm">
              <span className="text-[var(--color-muted)]">Elegíveis</span>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                <div
                  className="h-full rounded-full bg-[#16804B]"
                  style={{ width: `${elegiveisPercent}%` }}
                />
              </div>
              <b className="text-right text-[var(--color-title)]">
                {elegiveisCount}
              </b>
            </div>

            <div className="grid grid-cols-[100px_1fr_36px] items-center gap-3 text-sm">
              <span className="text-[var(--color-muted)]">Incluídos</span>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                <div
                  className="h-full rounded-full bg-[#2563B8]"
                  style={{ width: `${incluidosPercent}%` }}
                />
              </div>
              <b className="text-right text-[var(--color-title)]">
                {ps.length}
              </b>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-[var(--color-title)]">
            Situação das visitas
          </h2>

          <div className="flex flex-col divide-y divide-[#e2e8f0]">
            {(["Agendada", "Pendente", "Realizada"] as const).map((status) => (
              <div
                key={status}
                className="flex items-center justify-between py-3"
              >
                <PrototipoBadge>{status}</PrototipoBadge>
                <strong className="text-base font-bold text-[var(--color-title)]">
                  {vs.filter((v) => v.status === status).length}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-base font-bold text-[var(--color-title)]">
            Resumo por estudo
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="bg-[var(--color-primary)] text-white">
                <th className="px-5 py-3.5 font-semibold">Estudo</th>
                <th className="px-5 py-3.5 font-semibold">Candidatos</th>
                <th className="px-5 py-3.5 font-semibold">
                  Participantes no protótipo
                </th>
                <th className="px-5 py-3.5 font-semibold">Visitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {studies
                .filter((s) => estudoId === "Todos" || String(s.id) === estudoId)
                .map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-[var(--color-title)]">
                      {s.title}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text)]">
                      {candidates.filter((c) => c.studyId === s.id).length}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text)]">
                      {participants.filter((p) => p.studyId === s.id).length}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text)]">
                      {visits.filter((v) => v.studyId === s.id).length}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
