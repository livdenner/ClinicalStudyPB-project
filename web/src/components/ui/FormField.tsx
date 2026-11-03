import type { ReactNode } from "react";
import { ErrorMessage } from "./ErrorMessage";

type Props = { label: string; htmlFor: string; error?: string; children: ReactNode };

export function FormField({ label, htmlFor, error, children }: Props) {
    return (
        <div className="form-field">
            <label htmlFor={htmlFor}>{label}</label>
            {children}
            <ErrorMessage message={error} />
        </div>
    );
}
