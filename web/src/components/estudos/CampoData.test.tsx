import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { parseDate } from "@internationalized/date";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampoData } from "./CampoData";

afterEach(cleanup);

describe("CampoData", () => {
    it("exibe a data recebida em segmentos acessíveis", () => {
        render(
            <CampoData label="Data de início" value={parseDate("2026-11-01")} onChange={vi.fn()} />
        );
        expect(screen.getByText("Data de início *")).toBeInTheDocument();
        const valores = screen
            .getAllByRole("spinbutton")
            .map((segmento) => segmento.getAttribute("aria-valuenow"));
        expect(valores).toEqual(expect.arrayContaining(["2026", "11", "1"]));
    });

    it("envia a nova data quando o usuário altera um segmento pelo teclado", () => {
        const onChange = vi.fn();
        render(
            <CampoData label="Data de início" value={parseDate("2026-11-01")} onChange={onChange} />
        );
        const dia = screen
            .getAllByRole("spinbutton")
            .find((segmento) => segmento.getAttribute("data-type") === "day")!;
        fireEvent.keyDown(dia, { key: "ArrowUp", code: "ArrowUp" });
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ year: 2026, month: 11, day: 2 })
        );
    });

    it("bloqueia o calendário e a alteração pelo teclado quando está desabilitado", () => {
        const onChange = vi.fn();
        render(
            <CampoData
                label="Data de início"
                value={parseDate("2026-11-01")}
                onChange={onChange}
                isDisabled
            />
        );
        expect(screen.getByRole("button")).toBeDisabled();
        const dia = screen
            .getAllByRole("spinbutton")
            .find((segmento) => segmento.getAttribute("data-type") === "day")!;
        fireEvent.keyDown(dia, { key: "ArrowUp", code: "ArrowUp" });
        expect(onChange).not.toHaveBeenCalled();
    });

    it("mostra a mensagem de erro recebida pelo formulário", () => {
        render(
            <CampoData
                label="Data de término"
                value={null}
                onChange={vi.fn()}
                errorMessage="Informe a data de término."
            />
        );
        expect(screen.getByText("Informe a data de término.")).toBeInTheDocument();
    });
});
