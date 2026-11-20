import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { CheckCircle2, Copy } from "lucide-react";
import type { CadastroCandidatoApi } from "../../types/candidato";

type Props = { resultado: CadastroCandidatoApi; onFechar: () => void };

/** Confirma o cadastro sem persistir o código de demonstração fora deste modal. @author Lívia */
export function ResultadoCadastroCandidato({ resultado, onFechar }: Props) {
    const resumoRef = useRef<HTMLParagraphElement>(null);
    const [copia, setCopia] = useState<"inicial" | "sucesso" | "erro">("inicial");

    useEffect(() => {
        resumoRef.current?.focus();
    }, []);

    async function copiarCodigo() {
        if (resultado.status !== "INVITED") return;
        try {
            await navigator.clipboard.writeText(resultado.activation.activationCode);
            setCopia("sucesso");
        } catch {
            setCopia("erro");
        }
    }

    return (
        <>
            <Modal.Body className="mx-0 flex w-full min-w-0 flex-col gap-4 p-5">
                <p
                    ref={resumoRef}
                    role="status"
                    tabIndex={-1}
                    className="flex items-start gap-2 rounded-lg border border-[var(--color-success-border,#a7d7b8)] bg-[var(--color-success-soft,#e6f4eb)] p-3 text-sm text-[var(--color-success,#17613a)]"
                >
                    <CheckCircle2 size={20} className="shrink-0" aria-hidden="true" />
                    <span>
                        Cadastro de <strong>{resultado.name}</strong> concluído com sucesso.
                    </span>
                </p>
                <p className="break-words text-sm text-[var(--color-text)]">
                    {resultado.status === "INVITED" ? (
                        <>
                            Compartilhe o código com o candidato de e-mail{" "}
                            <strong>{resultado.email}</strong> para o primeiro acesso no aplicativo.
                        </>
                    ) : (
                        <>
                            O e-mail <strong>{resultado.email}</strong> já possui uma conta de
                            participante ativa. O candidato foi vinculado a este estudo.
                        </>
                    )}
                </p>
                {resultado.status === "INVITED" && (
                    <>
                        <div className="rounded-lg border border-[var(--color-warning-border,#e6cf83)] bg-[var(--color-warning-soft,#fff3ce)] p-3 text-sm text-[var(--color-warning,#725400)]">
                            <p className="font-semibold">Recurso de demonstração</p>
                            <p className="mt-1">
                                Ainda não há envio por e-mail. Este código aparece somente nesta
                                confirmação. Copie antes de fechar.
                            </p>
                        </div>
                        <div className="flex flex-col items-start gap-3 rounded-lg border border-[var(--color-border)] p-4">
                            <p id="codigo-ativacao-label" className="text-sm font-semibold">
                                Código de ativação
                            </p>
                            <output
                                aria-labelledby="codigo-ativacao-label"
                                aria-live="off"
                                className="max-w-full select-all break-all font-mono text-2xl font-bold tracking-widest text-[var(--color-title)]"
                            >
                                {resultado.activation.activationCode}
                            </output>
                            <Button type="button" variant="secondary" onPress={copiarCodigo}>
                                <Copy size={16} aria-hidden="true" /> Copiar código
                            </Button>
                            <p
                                role="status"
                                className={`text-sm ${copia === "erro" ? "text-[var(--color-error,#a62a25)]" : "text-[var(--color-success,#17613a)]"}`}
                            >
                                {copia === "sucesso"
                                    ? "Código copiado."
                                    : copia === "erro"
                                      ? "Não foi possível copiar automaticamente. Selecione o código acima para copiá-lo."
                                      : ""}
                            </p>
                        </div>
                        <p className="text-sm text-[var(--color-muted)]">
                            Válido até{" "}
                            <time dateTime={resultado.activation.expiresAt}>
                                {new Intl.DateTimeFormat("pt-BR", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                }).format(new Date(resultado.activation.expiresAt))}
                            </time>
                            . Após o candidato concluir a definição da senha, o código não poderá
                            ser reutilizado.
                        </p>
                    </>
                )}
            </Modal.Body>
            <Modal.Footer className="mt-0 shrink-0 justify-end border-t border-[var(--color-border)] px-5 py-4">
                <Button
                    type="button"
                    variant="primary"
                    onPress={onFechar}
                    className="bg-[var(--color-neutral,#475569)] text-white hover:bg-[var(--color-neutral,#475569)]/90"
                >
                    Concluir cadastro
                </Button>
            </Modal.Footer>
        </>
    );
}
