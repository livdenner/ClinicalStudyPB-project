import { Button, Chip, Table } from "@heroui/react";
import { Pencil } from "lucide-react";
import { ROLE_LABELS } from "../../types/auth";
import type { UserRole } from "../../types/auth";
import type { Usuario } from "../../types/usuario";

type Props = { usuarios: Usuario[]; onEditar: (usuario: Usuario) => void };

const ROLE_CHIP_CLASSES: Record<UserRole, string> = {
    ADMINISTRATOR: "bg-[#EDE9FE] text-[#5B3A91]",
    COORDINATOR: "bg-[#FCE7F3] text-[#943E73]",
    RESEARCHER: "bg-[#F2ECE6] text-[#75513A]",
    PARTICIPANT: "bg-[#E9F2FD] text-[#245A91]",
};

export function TabelaUsuarios({ usuarios, onEditar }: Props) {
    if (usuarios.length === 0) {
        return (
            <div className="px-5 py-12 text-center">
                <p className="font-semibold text-[var(--color-title)]">Nenhum usuário encontrado</p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                    Ajuste os filtros ou cadastre um novo usuário.
                </p>
            </div>
        );
    }
    return (
        <Table variant="secondary">
            <Table.ScrollContainer className="overflow-x-auto">
                <Table.Content
                    aria-label="Lista de usuários"
                    className="w-full min-w-[650px] text-left text-sm"
                >
                    <Table.Header>
                        {["Nome", "E-mail", "Perfil", "Situação", "Editar"].map((titulo) => (
                            <Table.Column
                                key={titulo}
                                id={titulo}
                                isRowHeader={titulo === "Nome"}
                                className="rounded-none bg-[var(--color-primary)] px-5 py-3.5 font-semibold text-white after:hidden"
                            >
                                {titulo}
                            </Table.Column>
                        ))}
                    </Table.Header>
                    <Table.Body items={usuarios}>
                        {(usuario) => (
                            <Table.Row
                                id={usuario.id}
                                textValue={usuario.name}
                                className="group border-b border-[var(--color-border)]"
                            >
                                <Table.Cell className="break-words border-[var(--color-border)] px-5 py-4 font-semibold text-[var(--color-title)] group-hover:bg-slate-50">
                                    {usuario.name}
                                </Table.Cell>
                                <Table.Cell className="break-all border-[var(--color-border)] px-5 py-4 text-[var(--color-text)] group-hover:bg-slate-50">
                                    {usuario.email}
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-4 text-[var(--color-text)] group-hover:bg-slate-50">
                                    <Chip
                                        size="sm"
                                        variant="soft"
                                        className={`font-semibold ${ROLE_CHIP_CLASSES[usuario.role]}`}
                                    >
                                        <Chip.Label>{ROLE_LABELS[usuario.role]}</Chip.Label>
                                    </Chip>
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-slate-50">
                                    <Chip
                                        size="sm"
                                        variant="soft"
                                        color={usuario.active ? "success" : "danger"}
                                        className={`font-semibold ${usuario.active ? "bg-[#E4F4E9] text-[#16804B]" : "bg-[#FDEAEA] text-[#B42318]"}`}
                                    >
                                        <Chip.Label>
                                            {usuario.active ? "Ativo" : "Inativo"}
                                        </Chip.Label>
                                    </Chip>
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-slate-50">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        isIconOnly
                                        aria-label={`Editar usuário: ${usuario.name}`}
                                        onPress={() => onEditar(usuario)}
                                        className="h-10 w-10 rounded-lg text-[var(--color-primary)] hover:bg-white"
                                    >
                                        <Pencil size={18} aria-hidden="true" />
                                    </Button>
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}
