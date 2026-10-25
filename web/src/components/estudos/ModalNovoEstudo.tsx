import { useState, type FormEvent } from "react";
import { Button, Input } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { X } from "lucide-react";
import { CampoData } from "./CampoData";
import type { StatusEstudo } from "../../types/estudo";

export type DadosNovoEstudo = {
    titulo: string;
    responsavel: string;
    participantes: number;
    limiteParticipantes: number;
    dataInicio: string;
    dataFim: string;
    status: StatusEstudo;
};

type ModalNovoEstudoProps = {
    onFechar: () => void;
    onCadastrar: (estudo: DadosNovoEstudo) => void;
};

export function ModalNovoEstudo({ onFechar, onCadastrar }: ModalNovoEstudoProps) {
    const [titulo, setTitulo] = useState("");
    const [responsavel, setResponsavel] = useState("");
    const [limite, setLimite] = useState("");
    const [dataInicio, setDataInicio] = useState<CalendarDate | null>(null);
    const [dataFim, setDataFim] = useState<CalendarDate | null>(null);
    const [erro, setErro] = useState("");

    function cadastrar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        if (!titulo.trim() || !responsavel.trim() || !limite || !dataInicio || !dataFim) {
            setErro("Preencha todos os campos obrigatórios.");
            return;
        }

        if (Number(limite) <= 0 || !Number.isFinite(Number(limite))) {
            setErro("O limite de participantes deve ser maior que zero.");
            return;
        }

        if (dataFim.compare(dataInicio) < 0) {
            setErro("A data de término deve ser igual ou posterior à data de início.");
            return;
        }

        onCadastrar({
            titulo: titulo.trim(),
            responsavel: responsavel.trim(),
            participantes: 0,
            limiteParticipantes: Number(limite),
            dataInicio: dataInicio.toString(),
            dataFim: dataFim.toString(),
            status: "Planejamento",
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
            onMouseDown={(evento) => {
                if (evento.target === evento.currentTarget) {
                    onFechar();
                }
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-modal"
                className="my-auto w-full max-w-xl rounded-xl bg-white shadow-xl"
            >
                <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
                    <div>
                        <h2
                            id="titulo-modal"
                            className="text-xl font-bold text-[var(--color-title)]"
                        >
                            Novo estudo
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-muted)]">
                            Preencha os dados do estudo clínico.
                        </p>
                    </div>

                    <Button isIconOnly variant="ghost" aria-label="Fechar modal" onPress={onFechar}>
                        <X size={20} />
                    </Button>
                </header>

                <form onSubmit={cadastrar}>
                    <div className="grid grid-cols-2 gap-4 p-5 max-[520px]:grid-cols-1">
                        <div className="col-span-2 flex flex-col gap-1 max-[520px]:col-span-1">
                            <label
                                htmlFor="titulo-estudo"
                                className="text-sm font-medium text-[var(--color-text)]"
                            >
                                Nome do estudo *
                            </label>

                            <Input
                                id="titulo-estudo"
                                aria-label="Nome do estudo"
                                placeholder="Digite o nome do estudo"
                                value={titulo}
                                onChange={(evento) => setTitulo(evento.target.value)}
                                className="h-10 text-sm text-[var(--color-text)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] focus-within:border-[var(--color-primary)]"
                            />
                        </div>

                        <div className="col-span-2 flex flex-col gap-1 max-[520px]:col-span-1">
                            <label
                                htmlFor="responsavel-estudo"
                                className="text-sm font-medium text-[var(--color-text)]"
                            >
                                Responsável *
                            </label>

                            <Input
                                id="responsavel-estudo"
                                aria-label="Responsável"
                                placeholder="Nome do responsável"
                                value={responsavel}
                                onChange={(evento) => setResponsavel(evento.target.value)}
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
                                htmlFor="limite-participantes"
                                className="text-sm font-medium text-[var(--color-text)]"
                            >
                                Limite de participantes *
                            </label>

                            <Input
                                id="limite-participantes"
                                aria-label="Limite de participantes"
                                type="number"
                                min={1}
                                placeholder="Ex.: 100"
                                value={limite}
                                onChange={(evento) => setLimite(evento.target.value)}
                                className="h-10 text-sm text-[var(--color-text)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] focus-within:border-[var(--color-primary)]"
                            />
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
                            Cadastrar estudo
                        </Button>
                    </footer>
                </form>
            </section>
        </div>
    );
}
