import { useState, type FormEvent } from "react";
import { Button, Input, Select, ListBox } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import type { CalendarDate } from "@internationalized/date";
import { X } from "lucide-react";
import { CampoData } from "./CampoData";
import { ErrorMessage } from "../ui/ErrorMessage";
import type { Estudo, StatusEstudo } from "../../types/estudo";
import { statusDisponiveis } from "../../utils/estudos";

type ModalEditarEstudoProps = {
    estudo: Estudo;
    onFechar: () => void;
    onSalvar: (estudoAtualizado: Estudo) => void;
};

// "Todos os status" é apenas filtro — não é um status válido de estudo.
const statusEditaveis = statusDisponiveis.filter((s): s is StatusEstudo => s !== "Todos os status");

export function ModalEditarEstudo({ estudo, onFechar, onSalvar }: ModalEditarEstudoProps) {
    const [titulo, setTitulo] = useState(estudo.titulo);
    const [responsavel, setResponsavel] = useState(estudo.responsavel);
    const [limite, setLimite] = useState(String(estudo.limiteParticipantes));
    const [status, setStatus] = useState<StatusEstudo>(estudo.status);
    const [dataInicio, setDataInicio] = useState<CalendarDate | null>(parseDate(estudo.dataInicio));
    const [dataFim, setDataFim] = useState<CalendarDate | null>(parseDate(estudo.dataFim));
    const [erro, setErro] = useState("");
    const [erroLimite, setErroLimite] = useState("");

    function salvar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        if (!titulo.trim() || !responsavel.trim() || !limite || !dataInicio || !dataFim) {
            setErro("Preencha todos os campos obrigatórios.");
            return;
        }

        const limiteParticipantes = Number(limite);

        if (limiteParticipantes <= 0 || !Number.isFinite(limiteParticipantes)) {
            setErroLimite("O limite de participantes deve ser maior que zero.");
            return;
        }

        if (limiteParticipantes < estudo.participantes) {
            setErroLimite(
                `O limite não pode ser menor que os ${estudo.participantes} participantes já alocados.`
            );
            return;
        }

        if (dataFim.compare(dataInicio) < 0) {
            setErro("A data de término deve ser igual ou posterior à data de início.");
            return;
        }

        onSalvar({
            ...estudo,
            titulo: titulo.trim(),
            responsavel: responsavel.trim(),
            limiteParticipantes,
            dataInicio: dataInicio.toString(),
            dataFim: dataFim.toString(),
            status,
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
            onMouseDown={(evento) => {
                if (evento.target === evento.currentTarget) onFechar();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-modal-editar"
                className="my-auto w-full max-w-xl rounded-xl bg-white shadow-xl"
            >
                <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
                    <div>
                        <h2
                            id="titulo-modal-editar"
                            className="text-xl font-bold text-[var(--color-title)]"
                        >
                            Editar estudo
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-muted)]">
                            Atualize os dados do estudo clínico.
                        </p>
                    </div>

                    <Button isIconOnly variant="ghost" aria-label="Fechar modal" onPress={onFechar}>
                        <X size={20} />
                    </Button>
                </header>

                <form onSubmit={salvar}>
                    <div className="grid grid-cols-2 gap-4 p-5 max-[520px]:grid-cols-1">
                        <div className="col-span-2 flex flex-col gap-1 max-[520px]:col-span-1">
                            <label
                                htmlFor="titulo-editar"
                                className="text-sm font-medium text-[var(--color-text)]"
                            >
                                Nome do estudo *
                            </label>

                            <Input
                                id="titulo-editar"
                                aria-label="Nome do estudo"
                                placeholder="Digite o nome do estudo"
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value)}
                                className="h-10 text-sm text-[var(--color-text)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] focus-within:border-[var(--color-primary)]"
                            />
                        </div>

                        <div className="col-span-2 flex flex-col gap-1 max-[520px]:col-span-1">
                            <label
                                htmlFor="responsavel-editar"
                                className="text-sm font-medium text-[var(--color-text)]"
                            >
                                Responsável *
                            </label>

                            <Input
                                id="responsavel-editar"
                                aria-label="Responsável"
                                placeholder="Nome do responsável"
                                value={responsavel}
                                onChange={(e) => setResponsavel(e.target.value)}
                                className="h-10 text-sm text-[var(--color-text)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] focus-within:border-[var(--color-primary)]"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <CampoData
                                label="Data de início"
                                value={dataInicio}
                                onChange={(data) => {
                                    setDataInicio(data);

                                    if (dataFim && data && dataFim.compare(data) < 0) {
                                        setDataFim(null);
                                    }
                                }}
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <CampoData
                                label="Data de término"
                                value={dataFim}
                                onChange={setDataFim}
                                minValue={dataInicio ?? undefined}
                            />
                        </div>

                        <div className="col-span-2 flex flex-col gap-1 max-[520px]:col-span-1">
                            <label
                                htmlFor="limite-editar"
                                className="text-sm font-medium text-[var(--color-text)]"
                            >
                                Limite de participantes *
                            </label>

                            <Input
                                id="limite-editar"
                                aria-label="Limite de participantes"
                                type="number"
                                min={1}
                                placeholder="Ex.: 100"
                                value={limite}
                                onChange={(e) => {
                                    setLimite(e.target.value);
                                    setErroLimite("");
                                }}
                                className="h-10 text-sm text-[var(--color-text)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] focus-within:border-[var(--color-primary)]"
                            />

                            <ErrorMessage message={erroLimite} />
                        </div>

                        <div className="col-span-2 flex flex-col gap-1 max-[520px]:col-span-1">
                            <label className="text-sm font-medium text-[var(--color-text)]">
                                Status
                            </label>

                            <Select
                                aria-label="Status do estudo"
                                selectedKey={status}
                                onSelectionChange={(valor) => {
                                    if (valor !== null) setStatus(valor as StatusEstudo);
                                }}
                                className="text-sm text-[var(--color-text)]"
                            >
                                <Select.Trigger className="h-10 rounded-lg border border-[var(--color-border)] bg-white shadow-none text-sm text-[var(--color-text)]">
                                    <Select.Value />
                                    <Select.Indicator />
                                </Select.Trigger>

                                <Select.Popover>
                                    <ListBox>
                                        {statusEditaveis.map((s) => (
                                            <ListBox.Item
                                                key={s}
                                                id={s}
                                                textValue={s}
                                                className="hover:bg-[var(--color-hover)]"
                                            >
                                                {s}
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                        </div>
                    </div>

                    {erro && (
                        <p role="alert" className="px-5 pb-3 text-sm text-red-600">
                            {erro}
                        </p>
                    )}

                    <footer className="flex justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
                        <Button
                            variant="secondary"
                            type="button"
                            onPress={onFechar}
                            className="border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[#EFEFF0]"
                        >
                            Cancelar
                        </Button>

                        <Button type="submit" variant="primary">
                            Salvar alterações
                        </Button>
                    </footer>
                </form>
            </section>
        </div>
    );
}
