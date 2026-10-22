import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "danger";
    loading?: boolean;
};

export function Button({ variant = "primary", loading, disabled, children, ...rest }: Props) {
    return (
        <button className={`btn btn-${variant}`} disabled={disabled || loading} {...rest}>
            {loading ? "Carregando..." : children}
        </button>
    );
}