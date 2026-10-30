import { CircleAlert } from "lucide-react";

export function NotFoundPage() {
    return (
        <section
            className="flex min-h-[calc(100vh-104px)] flex-col items-center justify-center px-6 py-10 text-center"
            aria-labelledby="not-found-title"
        >
            <CircleAlert
                aria-hidden="true"
                className="mb-4 h-12 w-12 text-[var(--color-primary)]"
                strokeWidth={1.6}
            />

            <p className="m-0 text-sm font-bold tracking-[0.12em] text-[var(--color-primary)]">
                404
            </p>

            <h1
                id="not-found-title"
                className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[var(--color-text)]"
            >
                Página não encontrada
            </h1>

            <p className="mt-[9px] max-w-[430px] text-[13px] leading-[1.65] text-[var(--color-muted)]">
                O endereço acessado não existe.
            </p>
        </section>
    );
}
