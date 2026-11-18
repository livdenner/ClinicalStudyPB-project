import { Button, FieldError, Input, Label, TextArea, TextField } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import type { DadosAtividadePrevista } from "../../../types/visita-prevista";

export type AtividadeFormulario = DadosAtividadePrevista & { chave: string };

type Props = {
    atividades: AtividadeFormulario[];
    onChange: (atividades: AtividadeFormulario[]) => void;
    bloqueado: boolean;
};

export function CamposAtividadesVisita({ atividades, onChange, bloqueado }: Props) {
    function alterar(indice: number, campo: "name" | "description", valor: string) {
        onChange(
            atividades.map((atividade, i) =>
                i === indice ? { ...atividade, [campo]: valor } : atividade
            )
        );
    }

    return (
        <section aria-labelledby="atividades-visita-heading" className="flex flex-col gap-3">
            <div>
                <h3
                    id="atividades-visita-heading"
                    className="font-semibold text-[var(--color-title)]"
                >
                    Atividades da visita
                </h3>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                    Inclua pelo menos uma atividade.
                </p>
            </div>
            {atividades.map((atividade, indice) => (
                <fieldset
                    key={atividade.chave}
                    disabled={bloqueado}
                    className="min-w-0 rounded-xl border border-[var(--color-border)] bg-slate-50/60 p-4"
                >
                    <legend className="px-1 text-sm font-semibold text-[var(--color-text)]">
                        Atividade {indice + 1}
                    </legend>
                    <div className="mb-3 flex justify-end gap-1">
                        <Button
                            isIconOnly
                            variant="ghost"
                            className="h-11 w-11 text-[var(--color-error)]"
                            aria-label={`Remover atividade ${indice + 1}`}
                            isDisabled={bloqueado || atividades.length === 1}
                            onPress={() => onChange(atividades.filter((_, i) => i !== indice))}
                        >
                            <Trash2 size={16} aria-hidden="true" />
                        </Button>
                    </div>
                    <TextField
                        name={`activities[${indice}].name`}
                        value={atividade.name}
                        onChange={(valor) => alterar(indice, "name", valor)}
                        isRequired
                        isDisabled={bloqueado}
                        validate={(valor) => (valor.trim() ? null : "Informe o nome da atividade.")}
                    >
                        <Label>Nome da atividade</Label>
                        <Input
                            maxLength={120}
                            className="h-11 rounded-lg border border-[var(--color-border)] bg-white px-3 shadow-none"
                        />
                        <FieldError />
                    </TextField>
                    <TextField
                        name={`activities[${indice}].description`}
                        value={atividade.description}
                        onChange={(valor) => alterar(indice, "description", valor)}
                        isRequired
                        isDisabled={bloqueado}
                        validate={(valor) => (valor.trim() ? null : "Descreva a atividade.")}
                        className="mt-3"
                    >
                        <Label>Descrição</Label>
                        <TextArea
                            maxLength={500}
                            rows={2}
                            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 shadow-none"
                        />
                        <FieldError />
                    </TextField>
                </fieldset>
            ))}
            <Button
                variant="secondary"
                className="min-h-11 self-start border border-[var(--color-border)] bg-white text-[var(--color-primary)]"
                isDisabled={bloqueado}
                onPress={() =>
                    onChange([
                        ...atividades,
                        { chave: crypto.randomUUID(), name: "", description: "" },
                    ])
                }
            >
                <Plus size={18} aria-hidden="true" /> Adicionar atividade
            </Button>
        </section>
    );
}
