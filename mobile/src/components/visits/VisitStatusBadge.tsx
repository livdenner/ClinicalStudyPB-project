import {
  getVisitStatusVisual,
  visitStatusLabel,
} from '../../services/visits/visitPresentation';
import { StatusBadge } from '../StatusBadge';

interface VisitStatusBadgeProps {
  status: string;
}

/**
 * Selo semântico da situação da visita agendada (`SCHEDULED`, `DONE`,
 * `ABSENT` ou `CANCELLED`), com alternativa neutra para valores desconhecidos.
 */
export function VisitStatusBadge({ status }: VisitStatusBadgeProps) {
  const label = visitStatusLabel(status);
  const visual = getVisitStatusVisual(status);

  return (
    <StatusBadge
      accessibilityLabel={`Situação da visita: ${label}`}
      backgroundColor={visual.backgroundColor}
      borderColor={visual.borderColor}
      label={label}
      symbol={visual.symbol}
      textColor={visual.textColor}
    />
  );
}
