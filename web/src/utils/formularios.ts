export function focarPrimeiroCampoInvalido(formulario: HTMLFormElement | null): void {
    formulario
        ?.querySelector<HTMLElement>(
            'input[aria-invalid="true"], textarea[aria-invalid="true"], button[aria-invalid="true"], [role="spinbutton"][aria-invalid="true"], [aria-invalid="true"] [role="spinbutton"]'
        )
        ?.focus();
}
