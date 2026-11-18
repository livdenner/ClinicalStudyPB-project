import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, FieldError, Input, Label, Modal, TextArea, TextField } from "@heroui/react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { X } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import type { DadosEstudoApi, EstudoApi } from "../../types/estudo";
import { obterErrosCampos, obterMensagemErroAcesso } from "../../utils/erros-api";
import { focarPrimeiroCampoInvalido } from "../../utils/formularios";
import { CampoData } from "./CampoData";

type Props = {
    estudo?: EstudoApi;
    responsavel: { id: number; name: string };
    onFechar: () => void;
    onSalvar: (dados: DadosEstudoApi) => Promise<void>;
    somenteLeitura?: boolean;
};

const inputClass =
    "h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] shadow-none focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]";

// o valor máximo aceito pelo campo Integer do backend é 2147483647, mas vou colocar um limite de 1000000
const LIMITE_MAXIMO_PARTICIPANTES = 1000000;

export function ModalEstudo({
    estudo,
    responsavel,
    onFechar,
    onSalvar,
    somenteLeitura = false,
}: Props) {
    const [titulo, setTitulo] = useState(estudo?.title ?? "");
    const [objetivo, setObjetivo] = useState(estudo?.objective ?? "");
    const [limite, setLimite] = useState(String(estudo?.participantLimit ?? ""));
    const [dataInicio, setDataInicio] = useState<CalendarDate | null>(
        estudo ? parseDate(estudo.startDate) : null
    );
    const [dataFim, setDataFim] = useState<CalendarDate | null>(
        estudo ? parseDate(estudo.endDate) : null
    );
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);
    const erroRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        if (salvando) return;
        if (erro) erroRef.current?.focus();
        else if (Object.keys(errosCampos).length > 0) {
            focarPrimeiroCampoInvalido(formRef.current);
        }
    }, [erro, errosCampos, salvando]);

    function validarFormulario() {
        const campos: Record<string, string> = {};
        if (!titulo.trim()) campos.title = "Informe o nome do estudo.";
        else if (titulo.trim().length > 200) campos.title = "O nome deve ter até 200 caracteres.";
        if (!objetivo.trim()) campos.objective = "Informe o objetivo do estudo.";
        const limiteNumero = Number(limite);
        if (!Number.isInteger(limiteNumero) || limiteNumero <= 0) {
            campos.participantLimit = "Informe um número inteiro maior que zero.";
        } else if (limiteNumero > LIMITE_MAXIMO_PARTICIPANTES) {
            campos.participantLimit = "O limite informado excede o valor permitido.";
        }
        if (!dataInicio) campos.startDate = "Informe a data de início.";
        if (!dataFim) campos.endDate = "Informe a data de término.";
        else if (dataInicio && dataFim.compare(dataInicio) < 0) {
            campos.endDate = "A data de término deve ser igual ou posterior à data de início.";
        }
        return campos;
    }

    function tratarErroAoSalvar(error: unknown) {
        if (!(error instanceof ApiClientError)) {
            setErro("Não foi possível salvar o estudo. Tente novamente.");
            return;
        }
        const mensagemAcesso = obterMensagemErroAcesso(error);
        if (mensagemAcesso) {
            setErro(mensagemAcesso);
            return;
        }

        const camposApi = obterErrosCampos(error.fieldErrors, [
            "title",
            "objective",
            "startDate",
            "endDate",
            "participantLimit",
        ]);
        if (Object.keys(camposApi).length > 0) setErrosCampos(camposApi);
        else setErro(error.message);
    }

    async function salvar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (salvando || somenteLeitura) return;

        setErro("");
        const campos = validarFormulario();
        setErrosCampos(campos);
        if (Object.keys(campos).length > 0 || !dataInicio || !dataFim) return;

        setSalvando(true);
        try {
            await onSalvar({
                title: titulo.trim(),
                objective: objetivo.trim(),
                responsibleUserId: estudo?.responsibleUserId ?? responsavel.id,
                startDate: dataInicio.toString(),
                endDate: dataFim.toString(),
                participantLimit: Number(limite),
            });
        } catch (error) {
            tratarErroAoSalvar(error);
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
                className="bg-black/40"
            >
                <Modal.Container
                    placement="center"
                    scroll="inside"
                    className="p-4 sm:w-full sm:p-4"
                >
                    <Modal.Dialog
                        aria-labelledby="titulo-modal-estudo"
                        className="max-h-[min(90dvh,100%)] max-w-xl rounded-xl border-0 bg-white p-0 text-[var(--color-text)] shadow-xl"
                    >
                        <Modal.Header className="shrink-0 flex-row items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
                            <div>
                                <Modal.Heading
                                    level={2}
                                    id="titulo-modal-estudo"
                                    className="text-xl font-bold text-[var(--color-title)]"
                                >
                                    {somenteLeitura
                                        ? "Consultar estudo"
                                        : estudo
                                          ? "Editar estudo"
                                          : "Novo estudo"}
                                </Modal.Heading>
                                <p className="mt-1 text-sm text-[var(--color-muted)]">
                                    {somenteLeitura
                                        ? "Este estudo está disponível somente para consulta."
                                        : estudo
                                          ? "Atualize os dados do estudo clínico."
                                          : "Preencha os dados do estudo clínico."}
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
                        <form
                            ref={formRef}
                            noValidate
                            onSubmit={salvar}
                            className="flex min-h-0 flex-col overflow-hidden"
                        >
                            <Modal.Body className="grid grid-cols-2 gap-4 p-5 max-[520px]:grid-cols-1">
                                {erro && (
                                    <p
                                        ref={erroRef}
                                        role="alert"
                                        tabIndex={-1}
                                        className="col-span-full rounded-lg bg-[var(--color-error-soft)] p-3 text-sm text-[var(--color-error)]"
                                    >
                                        {erro}
                                    </p>
                                )}
                                <TextField
                                    name="title"
                                    value={titulo}
                                    onChange={setTitulo}
                                    isRequired
                                    validationBehavior="aria"
                                    isDisabled={salvando || somenteLeitura}
                                    isInvalid={Boolean(errosCampos.title)}
                                    className="col-span-full flex flex-col gap-1"
                                >
                                    <Label className="text-sm font-medium">Nome do estudo</Label>
                                    <Input
                                        className={inputClass}
                                        maxLength={200}
                                        placeholder="Digite o nome do estudo"
                                    />
                                    <FieldError>{errosCampos.title}</FieldError>
                                </TextField>
                                <TextField
                                    name="objective"
                                    value={objetivo}
                                    onChange={setObjetivo}
                                    isRequired
                                    validationBehavior="aria"
                                    isDisabled={salvando || somenteLeitura}
                                    isInvalid={Boolean(errosCampos.objective)}
                                    className="col-span-full flex flex-col gap-1"
                                >
                                    <Label className="text-sm font-medium">Objetivo</Label>
                                    <TextArea
                                        rows={3}
                                        placeholder="Descreva o objetivo do estudo"
                                        className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-none focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                                    />
                                    <FieldError>{errosCampos.objective}</FieldError>
                                </TextField>
                                <div className="col-span-full flex flex-col gap-1">
                                    <p className="text-sm font-medium">Responsável</p>
                                    <p className="text-sm text-[var(--color-muted)]">
                                        {responsavel.name}
                                    </p>
                                </div>
                                <CampoData
                                    label="Data de início"
                                    value={dataInicio}
                                    onChange={setDataInicio}
                                    isDisabled={salvando || somenteLeitura}
                                    errorMessage={errosCampos.startDate}
                                />
                                <CampoData
                                    label="Data de término"
                                    value={dataFim}
                                    onChange={setDataFim}
                                    minValue={dataInicio ?? undefined}
                                    isDisabled={salvando || somenteLeitura}
                                    errorMessage={errosCampos.endDate}
                                />
                                <TextField
                                    name="participantLimit"
                                    type="number"
                                    value={limite}
                                    onChange={setLimite}
                                    isRequired
                                    validationBehavior="aria"
                                    isDisabled={salvando || somenteLeitura}
                                    isInvalid={Boolean(errosCampos.participantLimit)}
                                    className="col-span-full flex flex-col gap-1"
                                >
                                    <Label className="text-sm font-medium">
                                        Limite de participantes
                                    </Label>
                                    <Input
                                        className={inputClass}
                                        min={1}
                                        max={LIMITE_MAXIMO_PARTICIPANTES}
                                        step={1}
                                        placeholder="Ex.: 100"
                                    />
                                    <FieldError>{errosCampos.participantLimit}</FieldError>
                                </TextField>
                            </Modal.Body>
                            <Modal.Footer className="mt-0 shrink-0 justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    isDisabled={salvando}
                                    onPress={onFechar}
                                >
                                    {somenteLeitura ? "Fechar" : "Cancelar"}
                                </Button>
                                {!somenteLeitura && (
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        isDisabled={salvando}
                                        className="bg-[var(--color-primary)] text-white"
                                    >
                                        {salvando
                                            ? "Salvando..."
                                            : estudo
                                              ? "Salvar alterações"
                                              : "Cadastrar estudo"}
                                    </Button>
                                )}
                            </Modal.Footer>
                        </form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
