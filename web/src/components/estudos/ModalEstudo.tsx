import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
} from "@heroui/react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { X } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import type { DadosEstudoApi, EstudoApi } from "../../types/estudo";
import { CampoData } from "./CampoData";

type Props = {
  estudo?: EstudoApi;
  responsavel: { id: number; name: string };
  onFechar: () => void;
  onSalvar: (dados: DadosEstudoApi) => Promise<void>;
};

const inputClass =
  "h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] shadow-none focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]";

export function ModalEstudo({
  estudo,
  responsavel,
  onFechar,
  onSalvar,
}: Props) {
  const [titulo, setTitulo] = useState(estudo?.title ?? "");
  const [objetivo, setObjetivo] = useState(estudo?.objective ?? "");
  const [limite, setLimite] = useState(String(estudo?.participantLimit ?? ""));
  const [dataInicio, setDataInicio] = useState<CalendarDate | null>(
    estudo ? parseDate(estudo.startDate) : null,
  );
  const [dataFim, setDataFim] = useState<CalendarDate | null>(
    estudo ? parseDate(estudo.endDate) : null,
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
      formRef.current
        ?.querySelector<HTMLElement>(
          'input[aria-invalid="true"], textarea[aria-invalid="true"], [role="spinbutton"][aria-invalid="true"], [aria-invalid="true"] [role="spinbutton"]',
        )
        ?.focus();
    }
  }, [erro, errosCampos, salvando]);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;
    setErro("");
    const campos: Record<string, string> = {};
    if (!titulo.trim()) campos.title = "Informe o nome do estudo.";
    else if (titulo.trim().length > 200)
      campos.title = "O nome deve ter até 200 caracteres.";
    if (!objetivo.trim()) campos.objective = "Informe o objetivo do estudo.";
    const limiteNumero = Number(limite);
    if (
      !Number.isInteger(limiteNumero) ||
      limiteNumero <= 0 ||
      limiteNumero > 2147483647
    ) {
      campos.participantLimit =
        "Informe um limite inteiro entre 1 e 2147483647.";
    }
    if (!dataInicio) campos.startDate = "Informe a data de início.";
    if (!dataFim) campos.endDate = "Informe a data de término.";
    else if (dataInicio && dataFim.compare(dataInicio) < 0) {
      campos.endDate =
        "A data de término deve ser igual ou posterior à data de início.";
    }
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
        participantLimit: limiteNumero,
      });
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 401)
          setErro("Sua sessão expirou. Entre novamente para salvar.");
        else if (error.status === 403)
          setErro("Você não tem permissão para salvar estudos.");
        else {
          const camposApi = Object.fromEntries(
            error.fieldErrors
              .filter(({ field }) =>
                [
                  "title",
                  "objective",
                  "startDate",
                  "endDate",
                  "participantLimit",
                ].includes(field),
              )
              .map(({ field, message }) => [field, message]),
          );
          if (Object.keys(camposApi).length > 0) setErrosCampos(camposApi);
          else setErro(error.message);
        }
      } else setErro("Não foi possível salvar o estudo. Tente novamente.");
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
                  {estudo ? "Editar estudo" : "Novo estudo"}
                </Modal.Heading>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {estudo
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
                    className="col-span-full rounded-lg bg-[#FDEAEA] p-3 text-sm text-[#B42318]"
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
                  isDisabled={salvando}
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
                  isDisabled={salvando}
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
                  isDisabled={salvando}
                  errorMessage={errosCampos.startDate}
                />
                <CampoData
                  label="Data de término"
                  value={dataFim}
                  onChange={setDataFim}
                  minValue={dataInicio ?? undefined}
                  isDisabled={salvando}
                  errorMessage={errosCampos.endDate}
                />
                <TextField
                  name="participantLimit"
                  type="number"
                  value={limite}
                  onChange={setLimite}
                  isRequired
                  validationBehavior="aria"
                  isDisabled={salvando}
                  isInvalid={Boolean(errosCampos.participantLimit)}
                  className="col-span-full flex flex-col gap-1"
                >
                  <Label className="text-sm font-medium">
                    Limite de participantes
                  </Label>
                  <Input
                    className={inputClass}
                    min={1}
                    max={2147483647}
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
                  Cancelar
                </Button>
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
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
