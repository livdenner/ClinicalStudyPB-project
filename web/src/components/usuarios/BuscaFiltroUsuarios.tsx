import { Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { ROLE_LABELS, type UserRole } from "../../types/auth";
import type { FiltroSituacaoUsuario } from "../../types/usuario";

type BuscaFiltroUsuariosProps = {
    busca: string;
    perfil: UserRole | "";
    situacao: FiltroSituacaoUsuario;
    aoMudarBusca: (valor: string) => void;
    aoMudarPerfil: (valor: UserRole | "") => void;
    aoMudarSituacao: (valor: FiltroSituacaoUsuario) => void;
};

export function BuscaFiltroUsuarios({
    busca,
    perfil,
    situacao,
    aoMudarBusca,
    aoMudarPerfil,
    aoMudarSituacao,
}: BuscaFiltroUsuariosProps) {
    const filtroClass =
        "h-11 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] shadow-none focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]";

    return (
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 max-[900px]:grid-cols-1">
            <TextField
                id="busca-usuarios"
                type="search"
                value={busca}
                onChange={aoMudarBusca}
                className="flex flex-col gap-1"
            >
                <Label className="text-sm font-medium text-[var(--color-text)]">
                    Buscar por nome ou e-mail
                </Label>
                <Input className={filtroClass} placeholder="Buscar usuário..." />
            </TextField>
            <Select
                id="filtro-perfil"
                selectedKey={perfil || "todos"}
                onSelectionChange={(valor) => {
                    if (valor !== null) aoMudarPerfil(valor === "todos" ? "" : (valor as UserRole));
                }}
                className="flex flex-col gap-1"
            >
                <Label className="text-sm font-medium text-[var(--color-text)]">Perfil</Label>
                <Select.Trigger className={filtroClass}>
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        <ListBox.Item id="todos" textValue="Todos os perfis">
                            Todos os perfis
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((item) => (
                            <ListBox.Item key={item} id={item} textValue={ROLE_LABELS[item]}>
                                {ROLE_LABELS[item]}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
            <Select
                id="filtro-situacao"
                selectedKey={situacao || "todas"}
                onSelectionChange={(valor) => {
                    if (valor === "todas") aoMudarSituacao("");
                    else if (valor === "ativo" || valor === "inativo") aoMudarSituacao(valor);
                }}
                className="flex flex-col gap-1"
            >
                <Label className="text-sm font-medium text-[var(--color-text)]">Situação</Label>
                <Select.Trigger className={filtroClass}>
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        <ListBox.Item id="todas" textValue="Todas as situações">
                            Todas as situações
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="ativo" textValue="Ativo">
                            Ativo
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="inativo" textValue="Inativo">
                            Inativo
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    </ListBox>
                </Select.Popover>
            </Select>
        </div>
    );
}
