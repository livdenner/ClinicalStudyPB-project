import type { EstudoApi } from "../types/estudo";

const formatterMes = new Intl.DateTimeFormat("pt-BR", { month: "short" });

export function formatarPeriodo(inicio: string, fim: string): string {
  const dataInicio = new Date(`${inicio}T12:00:00`);
  const dataFim = new Date(`${fim}T12:00:00`);
  const mesInicio = formatterMes.format(dataInicio).replace(".", "");
  const mesFim = formatterMes.format(dataFim).replace(".", "");
  const anoInicio = dataInicio.getFullYear();
  const anoFim = dataFim.getFullYear();

  return anoInicio === anoFim
    ? `${mesInicio}–${mesFim} ${anoFim}`
    : `${mesInicio} ${anoInicio}–${mesFim} ${anoFim}`;
}

export function calcularOcupacao(participantes: number, limite: number): number {
  if (limite <= 0) return 0;
  return Math.min((participantes / limite) * 100, 100);
}

export function filtrarEstudos(estudos: EstudoApi[], busca: string): EstudoApi[] {
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  return estudos.filter((estudo) =>
    estudo.title.toLocaleLowerCase("pt-BR").includes(termo),
  );
}
