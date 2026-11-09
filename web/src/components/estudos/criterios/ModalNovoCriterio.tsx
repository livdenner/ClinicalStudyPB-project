import { useEffect, useRef, useState, type FormEvent } from "react";
import {
    Button,
    FieldError,
    Form,
    Label,
    ListBox,
    Modal,
    Select,
    TextArea,
    TextField,
} from "@heroui/react";
import { X } from "lucide-react";
import { ApiClientError } from "../../../services/api/apiClient";
import {
    TIPOS_CRITERIO_ESTUDO,
    type DadosCriterioEstudo,
    type TipoCriterioEstudo,
} from "../../../types/criterio-estudo";
import { obterErrosCampos, obterMensagemErroApi } from "../../../utils/erros-api";
import { focarPrimeiroCampoInvalido } from "../../../utils/formularios";

type Props = {
    requerAtualizacao: boolean;
    onFechar: () => void;
    onSalvar: (dados: DadosCriterioEstudo) => Promise<void>;
    onAtualizar: () => void;
};

export function ModalNovoCriterio({ requerAtualizacao, onFechar, onSalvar, onAtualizar }: Props) {
    const [tipo, setTipo] = useState<TipoCriterioEstudo | "">("");
    const [descricao, setDescricao] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});
    const erroRef = useRef<HTMLParagraphElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const bloqueado = salvando || requerAtualizacao;

    useEffect(() => {
        if (salvando) return;
        if (erro) erroRef.current?.focus();
        else if (Object.keys(errosCampos).length) focarPrimeiroCampoInvalido(formRef.current);
    }, [erro, errosCampos, salvando]);

    async function salvar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (bloqueado || !tipo) return;
        setErro("");
        setErrosCampos({});
        setSalvando(true);
        try {
            await onSalvar({ type: tipo, description: descricao.trim() });
        } catch (error) {
            const campos = ["type", "description"];
            if (
                error instanceof ApiClientError &&
                error.status === 400 &&
                error.fieldErrors.length &&
                error.fieldErrors.every(({ field }) => campos.includes(field))
            ) {
                setErrosCampos(obterErrosCampos(error.fieldErrors, campos));
            } else {
                setErro(
                    obterMensagemErroApi(
                        error,
                        "Não foi possível cadastrar o critério. Atualize os dados antes de tentar novamente."
                    )
                );
            }
        } finally {
            setSalvando(false);
        }
    }

    return (
        <Modal>
            <Modal.Backdrop
                isOpen
                isDismissable={!salvando}
                isKeyboardDismissDisabled={salvando}
                onOpenChange={(aberto) => {
                    if (!aberto && !salvando) onFechar();
                }}
            >
                <Modal.Container placement="center" scroll="inside" className="p-4">
                    <Modal.Dialog className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white p-0 text-[var(--color-text)] shadow-xl">
                        <Modal.Header className="flex flex-row items-center justify-between gap-3 border-b border-[var(--color-border)] p-5">
                            <Modal.Heading className="text-xl font-semibold text-[var(--color-title)]">
                                Novo critério
                            </Modal.Heading>
                            <Button
                                isIconOnly
                                variant="ghost"
                                aria-label="Fechar modal"
                                isDisabled={salvando}
                                onPress={onFechar}
                            >
                                <X size={20} aria-hidden="true" />
                            </Button>
                        </Modal.Header>
                        <Form
                            ref={formRef}
                            onSubmit={salvar}
                            validationErrors={errosCampos}
                            className="flex min-h-0 flex-col overflow-hidden"
                        >
                            <Modal.Body className="flex flex-col gap-5 p-5">
                                {erro && (
                                    <p
                                        ref={erroRef}
                                        role="alert"
                                        tabIndex={-1}
                                        className="rounded-lg bg-[#FDEAEA] p-3 text-sm text-[#B42318]"
                                    >
                                        {erro}
                                    </p>
                                )}
                                {requerAtualizacao && (
                                    <Button variant="secondary" onPress={onAtualizar}>
                                        Atualizar dados
                                    </Button>
                                )}
                                <Select
                                    name="type"
                                    placeholder="Selecione inclusão ou exclusão"
                                    selectedKey={tipo || null}
                                    isRequired
                                    isDisabled={bloqueado}
                                    validate={(valor) =>
                                        valor ? null : "Selecione o tipo de critério."
                                    }
                                    onSelectionChange={(valor) =>
                                        setTipo(
                                            valor === "INCLUSION" || valor === "EXCLUSION"
                                                ? valor
                                                : ""
                                        )
                                    }
                                >
                                    <Label>Tipo de critério</Label>
                                    <Select.Trigger className="h-11 rounded-lg border border-[var(--color-border)] bg-white px-3 shadow-none">
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            {(
                                                Object.keys(
                                                    TIPOS_CRITERIO_ESTUDO
                                                ) as TipoCriterioEstudo[]
                                            ).map((item) => (
                                                <ListBox.Item
                                                    key={item}
                                                    id={item}
                                                    textValue={TIPOS_CRITERIO_ESTUDO[item]}
                                                >
                                                    {TIPOS_CRITERIO_ESTUDO[item]}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            ))}
                                        </ListBox>
                                    </Select.Popover>
                                    <FieldError>
                                        {({ validationDetails, validationErrors }) =>
                                            validationDetails.valueMissing
                                                ? "Selecione o tipo de critério."
                                                : validationErrors.join(" ")
                                        }
                                    </FieldError>
                                </Select>
                                <TextField
                                    name="description"
                                    value={descricao}
                                    onChange={setDescricao}
                                    isRequired
                                    isDisabled={bloqueado}
                                    validate={(valor) =>
                                        !valor.trim()
                                            ? "Informe a descrição do critério."
                                            : valor.trim().length > 500
                                              ? "A descrição deve ter até 500 caracteres."
                                              : null
                                    }
                                >
                                    <Label>Descrição</Label>
                                    <TextArea
                                        maxLength={500}
                                        rows={4}
                                        placeholder="Descreva a condição de participação"
                                        className="min-h-28 resize-y rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 shadow-none"
                                    />
                                    <FieldError />
                                </TextField>
                            </Modal.Body>
                            <Modal.Footer className="shrink-0 justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
                                <Button
                                    variant="secondary"
                                    isDisabled={salvando}
                                    onPress={onFechar}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" variant="primary" isDisabled={bloqueado}>
                                    {salvando ? "Cadastrando..." : "Cadastrar critério"}
                                </Button>
                            </Modal.Footer>
                        </Form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
