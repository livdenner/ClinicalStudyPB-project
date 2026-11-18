import { Button, Chip, Table } from "@heroui/react";
import { Circle, Pause, Pencil } from "lucide-react";
import { SeloPerfil } from "./SeloPerfil";
import type { Usuario } from "../../types/usuario";

type Props = { usuarios: Usuario[]; onEditar: (usuario: Usuario) => void };

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
                                className="rounded-none border-b border-[var(--color-border)] bg-[var(--color-neutral-soft)] px-5 py-3 font-semibold text-[var(--color-neutral)] after:hidden"
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
                                <Table.Cell className="break-words border-[var(--color-border)] px-5 py-2.5 font-semibold text-[var(--color-title)] group-hover:bg-[var(--color-row-hover)]">
                                    {usuario.name}
                                </Table.Cell>
                                <Table.Cell className="break-all border-[var(--color-border)] px-5 py-2.5 text-[var(--color-neutral)] group-hover:bg-[var(--color-row-hover)]">
                                    {usuario.email}
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-2.5 text-[var(--color-text)] group-hover:bg-[var(--color-row-hover)]">
                                    <SeloPerfil perfil={usuario.role} />
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-2.5 group-hover:bg-[var(--color-row-hover)]">
                                    <Chip
                                        size="sm"
                                        variant="soft"
                                        className={`font-semibold ${usuario.active ? "bg-[var(--color-info-soft)] text-[var(--color-info)]" : "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]"}`}
                                    >
                                        <Chip.Label>
                                            <span className="inline-flex items-center gap-1.5">
                                                {usuario.active ? (
                                                    <Circle
                                                        size={7}
                                                        fill="currentColor"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <Pause size={12} aria-hidden="true" />
                                                )}
                                                {usuario.active ? "Ativo" : "Inativo"}
                                            </span>
                                        </Chip.Label>
                                    </Chip>
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-2.5 group-hover:bg-[var(--color-row-hover)]">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        isIconOnly
                                        aria-label={`Editar usuário: ${usuario.name}`}
                                        onPress={() => onEditar(usuario)}
                                        className="h-11 w-11 rounded-lg text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
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
