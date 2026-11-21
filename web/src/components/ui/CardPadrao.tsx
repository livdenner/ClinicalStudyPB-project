import { useId, type ReactNode } from "react";

type Props = {
    titulo: string;
    selo?: ReactNode;
    children: ReactNode;
    acoes?: ReactNode;
};

export function CardPadrao({ titulo, selo, children, acoes }: Props) {
    const tituloId = useId();
    return (
        <article className="card-padrao" aria-labelledby={tituloId}>
            <header className="card-padrao__cabecalho">
                <h3 id={tituloId}>{titulo}</h3>
                {selo && <div>{selo}</div>}
            </header>
            <div className="card-padrao__conteudo">{children}</div>
            {acoes && <footer className="card-padrao__acoes">{acoes}</footer>}
        </article>
    );
}

export function GradeCards({ rotulo, children }: { rotulo: string; children: ReactNode }) {
    return (
        <ul className="grade-cards" aria-label={rotulo}>
            {children}
        </ul>
    );
}
