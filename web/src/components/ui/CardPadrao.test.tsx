import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CardPadrao, GradeCards } from "./CardPadrao";

afterEach(cleanup);

it("preserva títulos completos e associa cada card ao seu próprio título", () => {
    const titulo =
        "Estudo com identificação extensa e informações que precisam continuar disponíveis";
    render(
        <GradeCards rotulo="Estudos">
            <li>
                <CardPadrao titulo={titulo} selo="Planejamento">
                    Objetivo do estudo
                </CardPadrao>
            </li>
            <li>
                <CardPadrao titulo="Outro estudo">Outro objetivo</CardPadrao>
            </li>
        </GradeCards>
    );
    const lista = screen.getByRole("list", { name: "Estudos" });
    expect(within(lista).getAllByRole("article")).toHaveLength(2);
    expect(
        within(screen.getByRole("article", { name: titulo })).getByRole("heading", { level: 3 })
    ).toHaveTextContent(titulo);
    expect(
        within(screen.getByRole("article", { name: "Outro estudo" })).getByText("Outro objetivo")
    ).toBeInTheDocument();
});

it("mantém o conteúdo e as ações no mesmo card e executa o callback correto", () => {
    const abrir = vi.fn();
    render(
        <CardPadrao
            titulo="Ana Silva"
            acoes={<button onClick={abrir}>Avaliar elegibilidade</button>}
        >
            42 anos
        </CardPadrao>
    );
    const card = screen.getByRole("article", { name: "Ana Silva" });
    expect(within(card).getByText("42 anos")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Avaliar elegibilidade" }));
    expect(abrir).toHaveBeenCalledOnce();
});
