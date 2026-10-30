import { useEffect, useRef, useState, type FormEvent } from "react";
import {
    Button,
    FieldError,
    Input,
    Label,
    ListBox,
    Modal,
    Select,
    Switch,
    TextField,
} from "@heroui/react";
import { Eye, EyeOff, X } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import { ROLE_LABELS, type UserRole } from "../../types/auth";
import type { DadosCadastroUsuario, Usuario } from "../../types/usuario";
import { ErrorMessage } from "../ui/ErrorMessage";

type Props = {
    usuario?: Usuario;
    onFechar: () => void;
    onSalvar: (dados: DadosCadastroUsuario, ativo?: boolean) => Promise<void>;
};

export function ModalUsuario({ usuario, onFechar, onSalvar }: Props) {
    const formRef = useRef<HTMLFormElement>(null);
    const errorRef = useRef<HTMLDivElement>(null);
    const voltarRef = useRef<HTMLButtonElement>(null);
    const [name, setName] = useState(usuario?.name ?? "");
    const [email, setEmail] = useState(usuario?.email ?? "");
    const [role, setRole] = useState<UserRole>(usuario?.role ?? "PARTICIPANT");
    const [password, setPassword] = useState("");
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [ativo, setAtivo] = useState(usuario?.active ?? true);
    const [confirmandoSituacao, setConfirmandoSituacao] = useState(false);
    const [erro, setErro] = useState("");
    const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});
    const ocupado = salvando;
    const camposBloqueados = salvando || confirmandoSituacao;

    useEffect(() => {
        if (confirmandoSituacao) voltarRef.current?.focus();
    }, [confirmandoSituacao]);

    useEffect(() => {
        if (ocupado) return;
        if (erro) {
            errorRef.current?.focus();
        } else if (Object.keys(errosCampos).length > 0) {
            formRef.current
                ?.querySelector<HTMLElement>(
                    'input[aria-invalid="true"], button[aria-invalid="true"]'
                )
                ?.focus();
        }
    }, [erro, errosCampos, ocupado]);

    async function salvar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (ocupado) return;
        setErro("");
        setErrosCampos({});
        const campos: Record<string, string> = {};
        if (!name.trim()) campos.name = "Informe o nome do usuário.";
        if (!email.trim()) campos.email = "Informe o e-mail do usuário.";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            campos.email = "Informe um endereço de e-mail válido.";
        }
        if (!usuario && !password.trim()) campos.password = "Informe uma senha.";
        if (Object.keys(campos).length > 0) {
            setErrosCampos(campos);
            return;
        }
        if (usuario && ativo !== usuario.active && !confirmandoSituacao) {
            setConfirmandoSituacao(true);
            return;
        }
        setSalvando(true);
        try {
            await onSalvar(
                {
                    name: name.trim(),
                    email: email.trim(),
                    role,
                    password,
                },
                usuario ? ativo : undefined
            );
        } catch (error) {
            if (error instanceof ApiClientError) {
                if (error.code === "PARTIAL_UPDATE") {
                    setErro(error.message);
                    return;
                }
                if (error.status === 409) {
                    setErrosCampos({
                        email: "Este e-mail já está cadastrado. Informe outro e-mail.",
                    });
                    return;
                }
                const camposApi = Object.fromEntries(
                    error.fieldErrors
                        .filter(({ field }) =>
                            ["name", "email", "role", ...(!usuario ? ["password"] : [])].includes(
                                field
                            )
                        )
                        .map((item) => [item.field, item.message])
                );
                if (error.status === 401) {
                    setErro("Sua sessão expirou. Entre novamente para salvar.");
                } else if (error.status === 403) {
                    setErro("Você não tem permissão para salvar usuários.");
                } else if (Object.keys(camposApi).length > 0) {
                    setErrosCampos(camposApi);
                } else {
                    setErro(error.message);
                }
            } else {
                setErro("Não foi possível salvar o usuário. Tente novamente.");
            }
        } finally {
            setSalvando(false);
            setConfirmandoSituacao(false);
        }
    }

    const inputClass =
        "h-11 rounded-lg border border-[var(--color-border)] bg-white px-3 text-base text-[var(--color-text)] shadow-none focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]";

    return (
        <Modal>
            <Modal.Backdrop
                isOpen
                onOpenChange={(aberto) => {
                    if (!aberto && !ocupado) onFechar();
                }}
                isDismissable={!ocupado}
                isKeyboardDismissDisabled={ocupado}
                className="bg-black/40"
            >
                <Modal.Container
                    placement="center"
                    scroll="inside"
                    className="p-4 sm:w-full sm:p-4"
                >
                    <Modal.Dialog
                        aria-labelledby="titulo-modal-usuario"
                        className="max-h-[min(90dvh,100%)] max-w-xl rounded-xl border-0 bg-white p-0 text-[var(--color-text)] shadow-xl"
                    >
                        <Modal.Header className="shrink-0 flex-row items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
                            <Modal.Heading
                                level={2}
                                id="titulo-modal-usuario"
                                className="text-xl font-bold text-[var(--color-title)]"
                            >
                                {usuario ? "Editar usuário" : "Novo usuário"}
                            </Modal.Heading>
                            <Button
                                type="button"
                                variant="ghost"
                                isIconOnly
                                isDisabled={ocupado}
                                aria-label="Fechar modal"
                                onPress={onFechar}
                            >
                                <X size={20} aria-hidden="true" />
                            </Button>
                        </Modal.Header>
                        <form
                            ref={formRef}
                            onSubmit={salvar}
                            aria-busy={ocupado}
                            className="flex min-h-0 flex-col overflow-hidden"
                        >
                            <Modal.Body className="m-0 flex flex-col gap-4 p-5 text-base leading-normal text-[var(--color-text)]">
                                {erro && (
                                    <div
                                        ref={errorRef}
                                        tabIndex={-1}
                                        className="rounded-lg bg-[#FDEAEA] p-3 focus-visible:outline-2"
                                    >
                                        <ErrorMessage message={erro} />
                                    </div>
                                )}
                                <TextField
                                    id="usuario-nome"
                                    value={name}
                                    onChange={setName}
                                    isRequired
                                    isDisabled={camposBloqueados}
                                    isInvalid={Boolean(errosCampos.name)}
                                    validationBehavior="aria"
                                    maxLength={120}
                                    autoComplete="name"
                                    className="flex flex-col gap-1"
                                >
                                    <Label className="text-sm font-medium text-[var(--color-text)]">
                                        Nome
                                    </Label>
                                    <Input className={inputClass} required />
                                    <FieldError className="text-sm text-[#b91c1c]">
                                        {errosCampos.name}
                                    </FieldError>
                                </TextField>
                                <TextField
                                    id="usuario-email"
                                    type="email"
                                    value={email}
                                    onChange={setEmail}
                                    isRequired
                                    isDisabled={camposBloqueados}
                                    isInvalid={Boolean(errosCampos.email)}
                                    validationBehavior="aria"
                                    maxLength={255}
                                    autoComplete="email"
                                    className="flex flex-col gap-1"
                                >
                                    <Label className="text-sm font-medium text-[var(--color-text)]">
                                        E-mail
                                    </Label>
                                    <Input className={inputClass} required />
                                    <FieldError className="text-sm text-[#b91c1c]">
                                        {errosCampos.email}
                                    </FieldError>
                                </TextField>
                                <Select
                                    id="usuario-perfil"
                                    selectedKey={role}
                                    onSelectionChange={(valor) => {
                                        if (valor !== null) setRole(valor as UserRole);
                                    }}
                                    isRequired
                                    isDisabled={camposBloqueados}
                                    isInvalid={Boolean(errosCampos.role)}
                                    validationBehavior="aria"
                                    className="flex flex-col gap-1"
                                >
                                    <Label className="text-sm font-medium text-[var(--color-text)]">
                                        Perfil
                                    </Label>
                                    <Select.Trigger className={inputClass}>
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            {(Object.keys(ROLE_LABELS) as UserRole[]).map(
                                                (perfil) => (
                                                    <ListBox.Item
                                                        key={perfil}
                                                        id={perfil}
                                                        textValue={ROLE_LABELS[perfil]}
                                                    >
                                                        {ROLE_LABELS[perfil]}
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                )
                                            )}
                                        </ListBox>
                                    </Select.Popover>
                                    <FieldError className="text-sm text-[#b91c1c]">
                                        {errosCampos.role}
                                    </FieldError>
                                </Select>
                                {usuario && (
                                    <section
                                        aria-labelledby="situacao-usuario-titulo"
                                        className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] p-4"
                                    >
                                        <h3
                                            id="situacao-usuario-titulo"
                                            className="text-sm font-medium"
                                        >
                                            Situação da conta
                                        </h3>
                                        <Switch
                                            isSelected={ativo}
                                            onChange={setAtivo}
                                            isDisabled={camposBloqueados}
                                        >
                                            <Switch.Content>
                                                <Switch.Control>
                                                    <Switch.Thumb />
                                                </Switch.Control>
                                                <Label className="text-sm text-[var(--color-text)]">
                                                    {ativo ? "Ativo" : "Inativo"}
                                                </Label>
                                            </Switch.Content>
                                        </Switch>
                                        {confirmandoSituacao && (
                                            <p
                                                role="status"
                                                className="rounded-lg bg-[var(--color-primary-soft)] p-3 text-sm text-[var(--color-title)]"
                                            >
                                                Deseja {ativo ? "ativar" : "desativar"} a conta?
                                            </p>
                                        )}
                                    </section>
                                )}
                                {!usuario && (
                                    <TextField
                                        id="usuario-senha"
                                        type={mostrarSenha ? "text" : "password"}
                                        value={password}
                                        onChange={setPassword}
                                        isRequired
                                        isDisabled={ocupado}
                                        isInvalid={Boolean(errosCampos.password)}
                                        validationBehavior="aria"
                                        autoComplete="new-password"
                                        className="flex flex-col gap-1"
                                    >
                                        <Label className="text-sm font-medium text-[var(--color-text)]">
                                            Senha
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input className={inputClass} required />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                isIconOnly
                                                isDisabled={ocupado}
                                                aria-label={
                                                    mostrarSenha ? "Ocultar senha" : "Mostrar senha"
                                                }
                                                onPress={() => setMostrarSenha((atual) => !atual)}
                                            >
                                                {mostrarSenha ? (
                                                    <EyeOff size={20} aria-hidden="true" />
                                                ) : (
                                                    <Eye size={20} aria-hidden="true" />
                                                )}
                                            </Button>
                                        </div>
                                        <FieldError className="text-sm text-[#b91c1c]">
                                            {errosCampos.password}
                                        </FieldError>
                                    </TextField>
                                )}
                            </Modal.Body>
                            <Modal.Footer className="mt-0 shrink-0 justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
                                <Button
                                    ref={voltarRef}
                                    type="button"
                                    variant="secondary"
                                    isDisabled={ocupado}
                                    onPress={() => {
                                        if (confirmandoSituacao) setConfirmandoSituacao(false);
                                        else onFechar();
                                    }}
                                >
                                    {confirmandoSituacao ? "Voltar" : "Cancelar"}
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    className="bg-[var(--color-primary)] text-white"
                                    isDisabled={ocupado}
                                >
                                    {salvando
                                        ? "Salvando..."
                                        : confirmandoSituacao
                                          ? "Confirmar"
                                          : usuario
                                            ? "Salvar alterações"
                                            : "Cadastrar usuário"}
                                </Button>
                            </Modal.Footer>
                        </form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
