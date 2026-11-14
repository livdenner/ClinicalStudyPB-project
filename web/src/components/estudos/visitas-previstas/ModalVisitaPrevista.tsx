import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, FieldError, Form, Input, Label, Modal, TextField } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { X } from "lucide-react";
import type { EstudoApi } from "../../../types/estudo";
import type { DadosVisitaPrevista, VisitaPrevista } from "../../../types/visita-prevista";
import { ApiClientError } from "../../../services/api/apiClient";
import { obterErrosCampos, obterMensagemErroApi } from "../../../utils/erros-api";
import { focarPrimeiroCampoInvalido } from "../../../utils/formularios";
import { CampoData } from "../CampoData";
import { CamposAtividadesVisita, type AtividadeFormulario } from "./CamposAtividadesVisita";

type Props = {
    estudo: EstudoApi;
    visita?: VisitaPrevista;
    quantidade: number;
    requerAtualizacao: boolean;
    onFechar: () => void;
    onSalvar: (dados: DadosVisitaPrevista) => Promise<void>;
    onAtualizar: () => void;
};

export function ModalVisitaPrevista({
    estudo,
    visita,
    quantidade,
    requerAtualizacao,
    onFechar,
    onSalvar,
    onAtualizar,
}: Props) {
    const [nome, setNome] = useState(visita?.name ?? "");
    const [data, setData] = useState(visita ? parseDate(visita.plannedDate) : null);
    const [posicao, setPosicao] = useState(String(visita?.position ?? quantidade + 1));
    const [atividades, setAtividades] = useState<AtividadeFormulario[]>(() =>
        visita
            ? visita.activities.map(({ id, name, description }) => ({
                  id,
                  name,
                  description,
                  chave: String(id),
              }))
            : [{ chave: crypto.randomUUID(), name: "", description: "" }]
    );
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);
    const erroRef = useRef<HTMLParagraphElement>(null);
    const limitePosicao = quantidade + (visita ? 0 : 1);
    const camposBloqueados = salvando || requerAtualizacao;

    useEffect(() => {
        if (salvando) return;
        if (erro) erroRef.current?.focus();
        else if (Object.keys(errosCampos).length) focarPrimeiroCampoInvalido(formRef.current);
    }, [erro, errosCampos, salvando]);

    function validar() {
        const erros: Record<string, string> = {};
        if (!data) erros.plannedDate = "Informe a data prevista.";
        else if (data.toString() < estudo.startDate || data.toString() > estudo.endDate) {
            erros.plannedDate = "A data deve estar dentro do período do estudo.";
        }
        const nomes = new Set<string>();
        atividades.forEach((atividade, indice) => {
            const normalizado = atividade.name.trim().toLocaleLowerCase("pt-BR");
            if (nomes.has(normalizado))
                erros[`activities[${indice}].name`] =
                    "Use nomes diferentes para as atividades desta visita.";
            nomes.add(normalizado);
        });
        setErrosCampos(erros);
        if (atividades.length === 0) setErro("Inclua pelo menos uma atividade.");
        return Object.keys(erros).length === 0 && atividades.length > 0;
    }

    function tratarErro(error: unknown) {
        if (error instanceof ApiClientError && error.status === 400) {
            const camposFormulario = [
                "name",
                "position",
                "plannedDate",
                ...atividades.flatMap((_, i) => [
                    `activities[${i}].name`,
                    `activities[${i}].description`,
                ]),
            ];
            const campos = obterErrosCampos(error.fieldErrors, camposFormulario);
            if (
                Object.keys(campos).length &&
                error.fieldErrors.every(({ field }) => camposFormulario.includes(field))
            ) {
                setErrosCampos(campos);
                return;
            }
        }
        setErro(
            obterMensagemErroApi(
                error,
                "Não foi possível salvar a visita. Atualize os dados antes de tentar novamente."
            )
        );
    }

    async function salvar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (camposBloqueados) return;
        setErro("");
        if (!validar() || !data) return;
        setSalvando(true);
        try {
            await onSalvar({
                name: nome.trim(),
                plannedDate: data.toString(),
                position: Number(posicao),
                activities: atividades.map(({ id, name, description }) => ({
                    id,
                    name: name.trim(),
                    description: description.trim(),
                })),
            });
        } catch (error) {
            tratarErro(error);
        } finally {
            setSalvando(false);
        }
    }

    return (
        <Modal>
            <Modal.Backdrop
                isOpen
                onOpenChange={(aberto) => {
                    if (!aberto && !salvando) onFechar();
                }}
                isDismissable={!salvando}
                isKeyboardDismissDisabled={salvando}
            >
                <Modal.Container placement="center" scroll="inside" className="p-4">
                    <Modal.Dialog className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white p-0 text-[var(--color-text)] shadow-xl">
                        <Modal.Header className="flex flex-row items-start justify-between gap-3 border-b border-[var(--color-border)] p-5">
                            <div>
                                <Modal.Heading className="text-xl font-semibold text-[var(--color-title)]">
                                    {visita ? "Editar visita prevista" : "Nova visita prevista"}
                                </Modal.Heading>
                                <p className="mt-1 text-sm text-[var(--color-muted)]">
                                    Defina a visita e as atividades do protocolo.
                                </p>
                            </div>
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
                                        className="rounded-lg bg-[var(--color-error-soft)] p-3 text-sm text-[var(--color-error)]"
                                    >
                                        {erro}
                                    </p>
                                )}
                                {requerAtualizacao && (
                                    <Button variant="secondary" onPress={onAtualizar}>
                                        Atualizar dados
                                    </Button>
                                )}
                                <TextField
                                    name="name"
                                    value={nome}
                                    onChange={setNome}
                                    isRequired
                                    isDisabled={camposBloqueados}
                                    validate={(valor) =>
                                        valor.trim() ? null : "Informe o nome da visita."
                                    }
                                >
                                    <Label>Nome da visita</Label>
                                    <Input
                                        maxLength={120}
                                        placeholder="Ex.: Avaliação inicial"
                                        className="h-11 rounded-lg border border-[var(--color-border)] bg-white px-3 shadow-none"
                                    />
                                    <FieldError />
                                </TextField>
                                <div className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
                                    <CampoData
                                        label="Data prevista"
                                        value={data}
                                        onChange={(valor) => {
                                            setData(valor);
                                            setErrosCampos((atuais) => ({
                                                ...atuais,
                                                plannedDate: "",
                                            }));
                                        }}
                                        minValue={parseDate(estudo.startDate)}
                                        maxValue={parseDate(estudo.endDate)}
                                        isDisabled={camposBloqueados}
                                        errorMessage={errosCampos.plannedDate}
                                    />
                                    <TextField
                                        name="position"
                                        value={posicao}
                                        onChange={setPosicao}
                                        isRequired
                                        isDisabled={camposBloqueados}
                                        validate={(valor) =>
                                            Number.isInteger(Number(valor)) &&
                                            Number(valor) >= 1 &&
                                            Number(valor) <= limitePosicao
                                                ? null
                                                : `Informe uma ordem entre 1 e ${limitePosicao}.`
                                        }
                                    >
                                        <Label>Ordem da visita</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={limitePosicao}
                                            step={1}
                                            className="h-11 rounded-lg border border-[var(--color-border)] bg-white px-3 shadow-none"
                                        />
                                        <FieldError />
                                    </TextField>
                                </div>
                                <CamposAtividadesVisita
                                    atividades={atividades}
                                    onChange={(novas) => {
                                        setAtividades(novas);
                                        setErrosCampos({});
                                    }}
                                    bloqueado={camposBloqueados}
                                />
                            </Modal.Body>
                            <Modal.Footer className="flex justify-end gap-3 border-t border-[var(--color-border)] p-5">
                                <Button
                                    variant="secondary"
                                    isDisabled={salvando}
                                    onPress={onFechar}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isPending={salvando}
                                    isDisabled={requerAtualizacao}
                                >
                                    {salvando
                                        ? "Salvando..."
                                        : visita
                                          ? "Salvar alterações"
                                          : "Cadastrar visita"}
                                </Button>
                            </Modal.Footer>
                        </Form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
