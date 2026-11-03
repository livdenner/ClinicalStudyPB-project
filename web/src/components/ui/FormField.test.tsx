import { render, screen } from "@testing-library/react";
import { FormField } from "./FormField";

test("mostra o label e o erro", () => {
    render(
        <FormField label="E-mail" htmlFor="email" error="E-mail inválido">
            <input id="email" />
        </FormField>
    );
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("E-mail inválido");
});
