import { render, screen } from "@testing-library/react";
import { ErrorMessage } from "./ErrorMessage";

test("mostra a mensagem de erro", () => {
    render(<ErrorMessage message="Campo obrigatório" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Campo obrigatório");
});

test("não renderiza sem mensagem", () => {
    render(<ErrorMessage />);
    expect(screen.queryByRole("alert")).toBeNull();
});
