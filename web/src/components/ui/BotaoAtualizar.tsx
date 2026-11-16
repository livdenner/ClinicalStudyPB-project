import { Button, Tooltip } from "@heroui/react";
import { RefreshCw } from "lucide-react";

type Props = {
    rotulo: string;
    desabilitado?: boolean;
    onAtualizar: () => void;
};

export function BotaoAtualizar({ rotulo, desabilitado = false, onAtualizar }: Props) {
    return (
        <Tooltip delay={300}>
            <Button
                variant="secondary"
                isIconOnly
                aria-label={rotulo}
                isDisabled={desabilitado}
                onPress={onAtualizar}
                className="h-11 min-h-11 w-11 min-w-11 rounded-full border border-[var(--color-info)] bg-[var(--color-surface)] text-[var(--color-info)] shadow-none transition-colors hover:bg-[var(--color-info-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-info)]"
            >
                <RefreshCw size={19} strokeWidth={2} aria-hidden="true" />
            </Button>
            <Tooltip.Content>{rotulo}</Tooltip.Content>
        </Tooltip>
    );
}
