import { useRef, useState } from "react";
import { UserCheck, X } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import type { CandidatoApi } from "../../types/candidato";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";

type Props = {
    estudoTitulo: string;
    candidato: CandidatoApi;
    vagasOcupadas: number;
    limiteVagas: number;
    onFechar: () => void;
    onConfirmar: () => Promise<void>;
};

export function ModalConfirmarInclusao({
    estudoTitulo,
    candidato,
    vagasOcupadas,
    limiteVagas,
    onFechar,
    onConfirmar,
}: Props) {
    const [incluindo, setIncluindo] = useState(false);
    const [erro, setErro] = useState("");
    const requisicaoEmAndamentoRef = useRef(false);

    const vagasRestantes = Math.max(0, limiteVagas - vagasOcupadas);

    async function handleConfirmar() {
        if (requisicaoEmAndamentoRef.current || incluindo) {
            return;
        }

        requisicaoEmAndamentoRef.current = true;
        setIncluindo(true);
        setErro("");

        try {
            await onConfirmar();
        } catch (error) {
            if (error instanceof ApiClientError) {
                if (error.status === 400 || error.status === 409) {
                    setErro(
                        error.message && !error.message.startsWith("A requisição falhou")
                            ? error.message
                            : "Não foi possível incluir o candidato: pré-condição de inclusão ou limite de vagas não atendido."
                    );
                } else if (error.status === 401) {
                    setErro("Sua sessão expirou. Entre novamente para incluir o participante.");
                } else if (error.status === 403) {
                    setErro("Você não tem permissão para incluir participantes neste estudo.");
                } else if (error.status === 404) {
                    setErro("Estudo ou candidato não encontrado para realizar a inclusão.");
                } else {
                    setErro(error.message);
                }
            } else {
                setErro("Não foi possível concluir a inclusão do participante. Tente novamente.");
            }
        } finally {
            requisicaoEmAndamentoRef.current = false;
            setIncluindo(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onClick={() => {
                if (!incluindo) onFechar();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-modal-inclusao"
                className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success)]">
                            <UserCheck size={18} aria-hidden="true" />
                        </div>
                        <div>
                            <h2
                                id="titulo-modal-inclusao"
                                className="text-lg font-bold text-[var(--color-title)]"
                            >
                                Confirmar inclusão de participante
                            </h2>
                            <p className="mt-1 text-xs text-[var(--color-muted)]">
                                Estudo: <strong>{estudoTitulo}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onFechar}
                        disabled={incluindo}
                        aria-label="Fechar modal"
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-slate-100 disabled:opacity-50"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </header>

                <div className="flex flex-col gap-4 p-5">
                    {erro && (
                        <div className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-soft)] p-3 text-sm text-[var(--color-error)]">
                            <ErrorMessage message={erro} />
                        </div>
                    )}

                    <p className="text-sm text-[var(--color-text)]">
                        Deseja confirmar a inclusão de <strong>{candidato.name}</strong> (
                        {candidato.age} anos) como participante oficial deste estudo clínico?
                    </p>

                    <dl className="grid grid-cols-3 gap-2.5 rounded-xl border border-[var(--color-border)] bg-[#F8FAFC] p-3.5 text-xs">
                        <div>
                            <dt className="text-[var(--color-muted)]">Elegibilidade</dt>
                            <dd className="mt-1 font-bold text-[var(--color-success)]">Elegível</dd>
                        </div>
                        <div>
                            <dt className="text-[var(--color-muted)]">Consentimento</dt>
                            <dd className="mt-1 font-bold text-[var(--color-success)]">Aceito</dd>
                        </div>
                        <div>
                            <dt className="text-[var(--color-muted)]">Vagas disponíveis</dt>
                            <dd className="mt-1 font-bold text-[var(--color-title)]">
                                {vagasRestantes} de {limiteVagas}
                            </dd>
                        </div>
                    </dl>

                    <p className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-xs text-[var(--color-warning)]">
                        Após confirmar a inclusão, uma vaga será ocupada no estudo e a decisão do
                        consentimento simulado ficará bloqueada contra alterações.
                    </p>

                    <footer className="mt-1 flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={incluindo}
                            onClick={onFechar}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            loading={incluindo}
                            disabled={incluindo}
                            onClick={() => void handleConfirmar()}
                            className="btn btn-primary inline-flex items-center gap-2 font-semibold"
                        >
                            Confirmar inclusão
                        </Button>
                    </footer>
                </div>
            </div>
        </div>
    );
}
