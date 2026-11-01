import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import type { DadosCandidatoApi } from "../../types/candidato";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";
import { FormField } from "../ui/FormField";
import { Input } from "../ui/Input";

type Props = {
    estudoTitulo: string;
    onFechar: () => void;
    onCadastrar: (dados: DadosCandidatoApi) => Promise<void>;
};

export function ModalNovoCandidato({ estudoTitulo, onFechar, onCadastrar }: Props) {
    const [nome, setNome] = useState("");
    const [idade, setIdade] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [errosCampos, setErrosCampos] = useState<{ name?: string; age?: string }>({});
    const nomeRef = useRef<HTMLInputElement>(null);
    const idadeRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        nomeRef.current?.focus();
    }, []);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (salvando) return;

        setErro("");
        const novosErros: { name?: string; age?: string } = {};
        const nomeLimpo = nome.trim();
        const idadeLimpa = idade.trim();
        const idadeNumero = Number(idadeLimpa);

        if (!nomeLimpo) {
            novosErros.name = "Informe a identificação do candidato.";
        } else if (nomeLimpo.length > 120) {
            novosErros.name = "A identificação deve ter até 120 caracteres.";
        }

        if (!idadeLimpa) {
            novosErros.age = "Informe a idade do candidato.";
        } else if (!Number.isInteger(idadeNumero) || idadeNumero < 1 || idadeNumero > 130) {
            novosErros.age = "Informe uma idade inteira válida entre 1 e 130.";
        }

        setErrosCampos(novosErros);

        if (novosErros.name) {
            nomeRef.current?.focus();
            return;
        }
        if (novosErros.age) {
            idadeRef.current?.focus();
            return;
        }

        setSalvando(true);
        try {
            await onCadastrar({
                name: nomeLimpo,
                age: idadeNumero,
            });
        } catch (error) {
            if (error instanceof ApiClientError) {
                if (error.status === 409) {
                    setErro(
                        error.message && !error.message.startsWith("A requisição falhou")
                            ? error.message
                            : "Já existe um candidato cadastrado com esta identificação neste estudo."
                    );
                } else if (error.status === 401) {
                    setErro("Sua sessão expirou. Entre novamente para cadastrar o candidato.");
                } else if (error.status === 403) {
                    setErro("Você não tem permissão para cadastrar candidatos.");
                } else {
                    const camposApi: { name?: string; age?: string } = {};
                    for (const item of error.fieldErrors) {
                        if (item.field === "name" || item.field === "age") {
                            camposApi[item.field] = item.message;
                        }
                    }
                    if (Object.keys(camposApi).length > 0) {
                        setErrosCampos(camposApi);
                    } else {
                        setErro(error.message);
                    }
                }
            } else {
                setErro("Não foi possível cadastrar o candidato. Tente novamente.");
            }
        } finally {
            setSalvando(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onClick={() => {
                if (!salvando) onFechar();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-modal-candidato"
                className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
                    <div>
                        <h2
                            id="titulo-modal-candidato"
                            className="text-xl font-bold text-[var(--color-title)]"
                        >
                            Novo candidato
                        </h2>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">
                            Vincular candidato ao estudo <strong>{estudoTitulo}</strong>.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onFechar}
                        disabled={salvando}
                        aria-label="Fechar modal"
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-slate-100 disabled:opacity-50"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </header>

                <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
                    {erro && (
                        <div className="rounded-lg bg-[#FDEAEA] p-3 text-sm text-[#B42318]">
                            <ErrorMessage message={erro} />
                        </div>
                    )}

                    <FormField
                        label="Identificação do candidato"
                        htmlFor="candidato-nome"
                        error={errosCampos.name}
                    >
                        <Input
                            ref={nomeRef}
                            id="candidato-nome"
                            name="name"
                            type="text"
                            value={nome}
                            onChange={(event) => setNome(event.target.value)}
                            disabled={salvando}
                            hasError={Boolean(errosCampos.name)}
                            maxLength={120}
                            placeholder="Ex.: Candidato 014"
                        />
                    </FormField>

                    <FormField
                        label="Idade"
                        htmlFor="candidato-idade"
                        error={errosCampos.age}
                    >
                        <Input
                            ref={idadeRef}
                            id="candidato-idade"
                            name="age"
                            type="number"
                            min={1}
                            max={130}
                            step={1}
                            value={idade}
                            onChange={(event) => setIdade(event.target.value)}
                            disabled={salvando}
                            hasError={Boolean(errosCampos.age)}
                            placeholder="Ex.: 42"
                        />
                    </FormField>

                    <footer className="mt-2 flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={salvando}
                            onClick={onFechar}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" loading={salvando}>
                            Cadastrar candidato
                        </Button>
                    </footer>
                </form>
            </div>
        </div>
    );
}
