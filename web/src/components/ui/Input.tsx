import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean };

export const Input = forwardRef<HTMLInputElement, Props>(({ hasError, ...rest }, ref) => (
    <input
        ref={ref}
        className={`input ${hasError ? "input-error" : ""}`}
        aria-invalid={hasError}
        {...rest}
    />
));
Input.displayName = "Input";
