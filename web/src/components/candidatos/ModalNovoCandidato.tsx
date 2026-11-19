import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, FieldError, Input, Label, Modal, TextField } from "@heroui/react";
import { X } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import type { CadastroCandidatoApi, DadosCandidatoApi } from "../../types/candidato";
import { obterErrosCampos } from "../../utils/erros-api";
import { focarPrimeiroCampoInvalido } from "../../utils/formularios";
import { ResultadoCadastroCandidato } from "./ResultadoCadastroCandidato";

type Props = {
    estudoTitulo: string;
    onFechar: () => void;
    onCadastrar: (dados: DadosCandidatoApi) => Promise<CadastroCandidatoApi>;
};

type Campo = keyof DadosCandidatoApi;
type DadosFormulario = Record<Campo, string>;
type CampoFormulario = {
    name: Campo;
    label: string;
    type: "text" | "email" | "tel" | "number";
    autoComplete: string;
    placeholder: string;
    maxLength?: number;
};

const CAMPOS: CampoFormulario[] = [
    {
        name: "name",
        label: "Nome do candidato",
        type: "text",
        autoComplete: "name",
        placeholder: "Ex.: Ana Souza",
        maxLength: 120,
    },
    {
        name: "email",
        label: "E-mail",
        type: "email",
        autoComplete: "email",
        placeholder: "Ex.: ana@exemplo.test",
        maxLength: 255,
    },
    {
        name: "phone",
        label: "Telefone",
        type: "tel",
        autoComplete: "tel",
        placeholder: "Ex.: (83) 99999-0000",
        maxLength: 20,
    },
    { name: "age", label: "Idade", type: "number", autoComplete: "off", placeholder: "Ex.: 42" },
];

function formatarTelefone(valor: string): string {
    const telefone = valor.trim();
    if (!/^[0-9 ()-]+$/.test(telefone)) return telefone;
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length !== 10 && digitos.length !== 11) return telefone;
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, -4)}-${digitos.slice(-4)}`;
}

function validar(dados: DadosFormulario): Partial<Record<Campo, string>> {
    const erros: Partial<Record<Campo, string>> = {};
    if (!dados.name.trim()) erros.name = "Informe o nome do candidato.";
    else if (dados.name.trim().length > 120) erros.name = "O nome deve ter até 120 caracteres.";
    if (!dados.email.trim()) erros.email = "Informe o e-mail do candidato.";
    else if (dados.email.trim().length > 255 || !/^[^\s@]+@[^\s@]+$/.test(dados.email.trim())) {
        erros.email = "Informe um e-mail válido com até 255 caracteres.";
    }
    const telefone = dados.phone.trim();
    if (!telefone) erros.phone = "Informe o telefone do candidato.";
    else if (!/^\+?[0-9 ()-]{8,20}$/.test(telefone) || telefone.replace(/\D/g, "").length < 8) {
        erros.phone = "Informe um telefone válido com DDD e até 20 caracteres.";
    }
    const idade = Number(dados.age);
    if (!dados.age.trim()) erros.age = "Informe a idade do candidato.";
    else if (!Number.isInteger(idade) || idade < 1 || idade > 130) {
        erros.age = "Informe uma idade inteira válida entre 1 e 130.";
    }
    return erros;
}

/** Cadastro e confirmação temporária do vínculo ou convite do candidato. @author Lívia */
export function ModalNovoCandidato({ estudoTitulo, onFechar, onCadastrar }: Props) {
    const [dados, setDados] = useState<DadosFormulario>({
        name: "",
        email: "",
        phone: "",
        age: "",
    });
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [errosCampos, setErrosCampos] = useState<Partial<Record<Campo, string>>>({});
    const [resultado, setResultado] = useState<CadastroCandidatoApi | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const erroRef = useRef<HTMLParagraphElement>(null);
    const enviandoRef = useRef(false);

    useEffect(() => {
        if (salvando) return;
        if (erro) erroRef.current?.focus();
        else if (Object.keys(errosCampos).length > 0) focarPrimeiroCampoInvalido(formRef.current);
    }, [erro, errosCampos, salvando]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (enviandoRef.current || resultado) return;
        setErro("");
        const erros = validar(dados);
        setErrosCampos(erros);
        if (Object.keys(erros).length > 0) return;

        enviandoRef.current = true;
        setSalvando(true);
        try {
            setResultado(
                await onCadastrar({
                    name: dados.name.trim(),
                    email: dados.email.trim().toLowerCase(),
                    phone: formatarTelefone(dados.phone),
                    age: Number(dados.age),
                })
            );
        } catch (error) {
            if (error instanceof ApiClientError) {
                setErro(error.message);
                setErrosCampos(
                    obterErrosCampos(
                        error.fieldErrors,
                        CAMPOS.map(({ name }) => name)
                    )
                );
            } else {
                setErro("Não foi possível cadastrar o candidato. Tente novamente.");
            }
        } finally {
            enviandoRef.current = false;
            setSalvando(false);
        }
    }

    const titulo = resultado
        ? resultado.status === "INVITED"
            ? "Convite emitido"
            : "Vinculado a conta existente"
        : "Novo candidato";

    return (
        <Modal>
            <Modal.Backdrop
                isOpen
                isDismissable={!salvando && !resultado}
                isKeyboardDismissDisabled={salvando}
                onOpenChange={(aberto) => {
                    if (!aberto && !salvando) onFechar();
                }}
                className="bg-black/45"
            >
                <Modal.Container
                    placement="center"
                    scroll="inside"
                    className="p-4 sm:w-full sm:p-4"
                >
                    <Modal.Dialog
                        aria-labelledby="titulo-modal-candidato"
                        className="max-h-[min(90dvh,100%)] w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface,#fff)] p-0 text-[var(--color-text)] shadow-xl [--color-error:#a62a25] [--color-success:#17613a] [--color-warning:#725400]"
                    >
                        <Modal.Header className="shrink-0 flex-row items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
                            <div className="min-w-0">
                                <Modal.Heading
                                    level={2}
                                    id="titulo-modal-candidato"
                                    className="text-xl font-bold text-[var(--color-title)]"
                                >
                                    {titulo}
                                </Modal.Heading>
                                <p className="mt-1 break-words text-sm text-[var(--color-muted)]">
                                    Cadastro no estudo <strong>{estudoTitulo}</strong>.
                                </p>
                            </div>
                            <Button
                                type="button"
                                isIconOnly
                                variant="ghost"
                                aria-label="Fechar modal"
                                isDisabled={salvando}
                                onPress={onFechar}
                            >
                                <X size={20} aria-hidden="true" />
                            </Button>
                        </Modal.Header>
                        {resultado ? (
                            <ResultadoCadastroCandidato resultado={resultado} onFechar={onFechar} />
                        ) : (
                            <form
                                ref={formRef}
                                noValidate
                                onSubmit={handleSubmit}
                                className="flex min-h-0 flex-col overflow-hidden"
                                aria-busy={salvando}
                            >
                                <Modal.Body className="mx-0 grid w-full min-w-0 grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                                    <p className="col-span-full text-sm text-[var(--color-muted)]">
                                        Todos os campos são obrigatórios.
                                    </p>
                                    {erro && (
                                        <p
                                            ref={erroRef}
                                            role="alert"
                                            tabIndex={-1}
                                            className="col-span-full rounded-lg border border-[var(--color-error-border,#efb6b1)] bg-[var(--color-error-soft,#fdeae8)] p-3 text-sm text-[var(--color-error,#a62a25)]"
                                        >
                                            {erro}
                                        </p>
                                    )}
                                    {CAMPOS.map((campo) => (
                                        <TextField
                                            key={campo.name}
                                            name={campo.name}
                                            type={campo.type}
                                            value={dados[campo.name]}
                                            onChange={(valor) =>
                                                setDados((atuais) => ({
                                                    ...atuais,
                                                    [campo.name]: valor,
                                                }))
                                            }
                                            isRequired
                                            validationBehavior="aria"
                                            isDisabled={salvando}
                                            isInvalid={Boolean(errosCampos[campo.name])}
                                            className={`flex min-w-0 flex-col gap-1 ${campo.name === "name" || campo.name === "email" ? "col-span-full" : ""}`}
                                        >
                                            <Label className="text-sm font-medium">
                                                {campo.label}
                                            </Label>
                                            <Input
                                                autoFocus={campo.name === "name"}
                                                autoComplete={campo.autoComplete}
                                                maxLength={campo.maxLength}
                                                min={campo.name === "age" ? 1 : undefined}
                                                max={campo.name === "age" ? 130 : undefined}
                                                step={campo.name === "age" ? 1 : undefined}
                                                placeholder={campo.placeholder}
                                                onBlur={
                                                    campo.name === "phone"
                                                        ? () =>
                                                              setDados((atuais) => ({
                                                                  ...atuais,
                                                                  phone: formatarTelefone(
                                                                      atuais.phone
                                                                  ),
                                                              }))
                                                        : undefined
                                                }
                                                className="h-10 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface,#fff)] px-3 text-sm text-[var(--color-text)] shadow-none focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] aria-invalid:border-[var(--color-error,#a62a25)]"
                                            />
                                            <FieldError className="text-sm text-[var(--color-error,#a62a25)]">
                                                {errosCampos[campo.name]}
                                            </FieldError>
                                        </TextField>
                                    ))}
                                </Modal.Body>
                                <Modal.Footer className="mt-0 shrink-0 flex-wrap justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        isDisabled={salvando}
                                        onPress={onFechar}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        isDisabled={salvando}
                                        className="bg-[var(--color-neutral,#475569)] text-white hover:bg-[var(--color-neutral,#475569)]/90"
                                    >
                                        {salvando ? "Cadastrando..." : "Cadastrar candidato"}
                                    </Button>
                                </Modal.Footer>
                            </form>
                        )}
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
