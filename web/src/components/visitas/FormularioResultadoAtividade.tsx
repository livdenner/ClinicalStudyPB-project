import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiClientError } from "../../services/api/apiClient";
import type {
    AtividadeComResultado,
    DadosResultadoAtividade,
    ResultadoAtividade,
} from "../../types/resultado-atividade";
import { formatarHorarioAgendamento } from "../../utils/agendamento";
import { Button } from "../ui/Button";

type Props = {
    atividade: AtividadeComResultado;
    podeEditar: boolean;
    ocupado: boolean;
    onSalvar: (activityId: number, dados: DadosResultadoAtividade) => Promise<ResultadoAtividade>;
};

/** Mantém o rascunho e o erro de cada atividade sem afetar as demais gravações. @author Lívia */
export function FormularioResultadoAtividade({ atividade, podeEditar, ocupado, onSalvar }: Props) {
    const [valor, setValor] = useState(atividade.result?.value ?? "");
    const [observacao, setObservacao] = useState(atividade.result?.note ?? "");
    const [rascunhoAlterado, setRascunhoAlterado] = useState(false);
    const [erro, setErro] = useState("");
    const [erroValor, setErroValor] = useState("");
    const [erroObservacao, setErroObservacao] = useState("");
    const [sucesso, setSucesso] = useState("");
    const [salvando, setSalvando] = useState(false);
    const enviandoRef = useRef(false);
    const valorRef = useRef<HTMLTextAreaElement>(null);
    const observacaoRef = useRef<HTMLTextAreaElement>(null);
    const erroRef = useRef<HTMLParagraphElement>(null);
    const baseId = `resultado-atividade-${atividade.activityId}`;
    const valorExibido = rascunhoAlterado ? valor : (atividade.result?.value ?? "");
    const observacaoExibida = rascunhoAlterado ? observacao : (atividade.result?.note ?? "");

    useEffect(() => {
        if (salvando) return;
        if (erro) erroRef.current?.focus();
        else if (erroValor) valorRef.current?.focus();
        else if (erroObservacao) observacaoRef.current?.focus();
    }, [erro, erroValor, erroObservacao, salvando]);

    async function salvar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (enviandoRef.current || ocupado || !podeEditar) return;
        const value = valorExibido.trim();
        const note = observacaoExibida.trim();
        setErro("");
        setSucesso("");
        setErroValor(
            !value
                ? "Informe o resultado da atividade."
                : value.length > 200
                  ? "O resultado deve ter até 200 caracteres."
                  : ""
        );
        setErroObservacao(note.length > 500 ? "A observação deve ter até 500 caracteres." : "");
        if (!value || value.length > 200 || note.length > 500) return;
        enviandoRef.current = true;
        setSalvando(true);
        try {
            const registrado = await onSalvar(atividade.activityId, {
                value,
                ...(note ? { note } : {}),
            });
            setValor(registrado.value);
            setObservacao(registrado.note ?? "");
            setRascunhoAlterado(false);
            setSucesso("Resultado salvo.");
        } catch (error) {
            if (error instanceof ApiClientError) {
                setErro(error.message);
                setErroValor(
                    error.fieldErrors.find((campo) => campo.field === "value")?.message ?? ""
                );
                setErroObservacao(
                    error.fieldErrors.find((campo) => campo.field === "note")?.message ?? ""
                );
            } else {
                setErro("Não foi possível salvar o resultado. Tente novamente.");
            }
        } finally {
            enviandoRef.current = false;
            setSalvando(false);
        }
    }

    return (
        <section
            aria-labelledby={`${baseId}-heading`}
            className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-4"
        >
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <h3
                        id={`${baseId}-heading`}
                        className="break-words font-semibold text-[var(--color-title)]"
                    >
                        {atividade.position}. {atividade.name}
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--color-muted)]">
                        {atividade.description}
                    </p>
                </div>
                <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${atividade.result ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"}`}
                >
                    {atividade.result ? "Registrado" : "Sem resultado"}
                </span>
            </header>
            {atividade.result && (
                <p className="text-xs text-[var(--color-muted)]">
                    Última gravação:{" "}
                    <time dateTime={atividade.result.recordedAt}>
                        {formatarHorarioAgendamento(atividade.result.recordedAt)}
                    </time>{" "}
                    (Fortaleza).
                </p>
            )}
            {!podeEditar && rascunhoAlterado && (
                <div
                    role="note"
                    className="rounded-lg bg-[var(--color-warning-soft)] p-3 text-sm text-[var(--color-warning)]"
                >
                    <p>Os campos não salvos foram mantidos, mas esta visita está em consulta.</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">
                        Resultado registrado: {atividade.result?.value ?? "Ainda não registrado."}
                    </p>
                    {atividade.result?.note && (
                        <p className="mt-1 whitespace-pre-wrap break-words">
                            Observação registrada: {atividade.result.note}
                        </p>
                    )}
                </div>
            )}
            <form noValidate onSubmit={salvar} aria-busy={salvando} className="flex flex-col gap-3">
                {erro && (
                    <p
                        ref={erroRef}
                        role="alert"
                        tabIndex={-1}
                        className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-soft)] p-3 text-sm text-[var(--color-error)]"
                    >
                        {erro}
                    </p>
                )}
                {sucesso && (
                    <p
                        role="status"
                        className="rounded-lg bg-[var(--color-success-soft)] p-3 text-sm text-[var(--color-success)]"
                    >
                        {sucesso}
                    </p>
                )}
                <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${baseId}-valor`} className="text-sm font-medium">
                        Resultado{podeEditar ? " *" : ""}
                    </label>
                    <textarea
                        ref={valorRef}
                        id={`${baseId}-valor`}
                        rows={2}
                        required={podeEditar}
                        maxLength={200}
                        value={valorExibido}
                        readOnly={!podeEditar}
                        disabled={ocupado}
                        onChange={(event) => {
                            setValor(event.target.value);
                            setObservacao(observacaoExibida);
                            setRascunhoAlterado(true);
                            setErroValor("");
                            setSucesso("");
                        }}
                        aria-invalid={Boolean(erroValor)}
                        aria-describedby={`${baseId}-valor-ajuda${erroValor ? ` ${baseId}-valor-erro` : ""}`}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] aria-invalid:border-[var(--color-error)] disabled:opacity-60"
                    />
                    <p id={`${baseId}-valor-ajuda`} className="text-xs text-[var(--color-muted)]">
                        {!podeEditar && rascunhoAlterado
                            ? "Rascunho não salvo; confira o resultado registrado acima."
                            : podeEditar
                              ? "Texto fictício de até 200 caracteres."
                              : atividade.result
                                ? "Resultado registrado na API."
                                : "Resultado ainda não registrado."}
                    </p>
                    {erroValor && (
                        <p
                            id={`${baseId}-valor-erro`}
                            className="text-sm text-[var(--color-error)]"
                        >
                            {erroValor}
                        </p>
                    )}
                </div>
                <details
                    open={Boolean(atividade.result?.note) || Boolean(erroObservacao)}
                    className="text-sm"
                >
                    <summary className="cursor-pointer font-medium text-[var(--color-primary)]">
                        Observação opcional
                    </summary>
                    <div className="mt-2 flex flex-col gap-1.5">
                        <label htmlFor={`${baseId}-observacao`} className="text-sm font-medium">
                            Observação
                        </label>
                        <textarea
                            ref={observacaoRef}
                            id={`${baseId}-observacao`}
                            rows={2}
                            maxLength={500}
                            value={observacaoExibida}
                            readOnly={!podeEditar}
                            disabled={ocupado}
                            onChange={(event) => {
                                setObservacao(event.target.value);
                                setValor(valorExibido);
                                setRascunhoAlterado(true);
                                setErroObservacao("");
                                setSucesso("");
                            }}
                            aria-invalid={Boolean(erroObservacao)}
                            aria-describedby={`${baseId}-observacao-ajuda${erroObservacao ? ` ${baseId}-observacao-erro` : ""}`}
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] aria-invalid:border-[var(--color-error)] disabled:opacity-60"
                        />
                        <p
                            id={`${baseId}-observacao-ajuda`}
                            className="text-xs text-[var(--color-muted)]"
                        >
                            Até 500 caracteres.
                            {podeEditar
                                ? " Deixar em branco remove a observação anterior ao salvar."
                                : ""}
                        </p>
                        {erroObservacao && (
                            <p
                                id={`${baseId}-observacao-erro`}
                                className="text-sm text-[var(--color-error)]"
                            >
                                {erroObservacao}
                            </p>
                        )}
                    </div>
                </details>
                {podeEditar && (
                    <footer className="flex justify-end">
                        <Button
                            type="submit"
                            variant="primary"
                            className={atividade.result ? "btn btn-primary" : "btn button--create"}
                            disabled={ocupado || salvando}
                            aria-label={`Salvar resultado: ${atividade.name}`}
                        >
                            {salvando ? "Salvando..." : "Salvar resultado"}
                        </Button>
                    </footer>
                )}
            </form>
        </section>
    );
}
