/**
 * Formata uma data civil `YYYY-MM-DD` sem converter fuso horário.
 * Valida dias por mês e anos bissextos em UTC, evitando que a conversão
 * para o fuso local exiba o dia anterior no Brasil.
 *
 * @param value Data no formato devolvido pela API.
 * @returns Data no padrão brasileiro ou `null` quando inválida.
 */
export function formatCivilDate(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }

  const [, year, month, day] = match;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
    return null;
  }

  const utcDate = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
  if (
    utcDate.getUTCFullYear() !== yearNumber ||
    utcDate.getUTCMonth() !== monthNumber - 1 ||
    utcDate.getUTCDate() !== dayNumber
  ) {
    return null;
  }

  return `${day}/${month}/${year}`;
}

/**
 * Formata um instante ISO no fuso local do dispositivo.
 *
 * @param value Instante devolvido pela API.
 * @returns Data e hora locais ou `null` quando inválido.
 */
export function formatDateTime(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
