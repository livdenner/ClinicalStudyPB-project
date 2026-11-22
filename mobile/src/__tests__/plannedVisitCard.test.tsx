import { render, screen } from '@testing-library/react-native';

import { PlannedVisitCard } from '../components/protocol/PlannedVisitCard';
import type { PlannedVisit } from '../services/protocol/protocolTypes';

const baseVisit: PlannedVisit = {
  id: 10,
  studyId: 1,
  name: 'Visita de acompanhamento',
  plannedDate: '2027-02-01',
  position: 1,
  activities: [
    {
      id: 21,
      name: 'Coleta inicial',
      description: 'Registro previsto no protocolo.',
      position: 1,
    },
    {
      id: 22,
      name: 'Aferição rápida',
      description: '',
      position: 2,
    },
  ],
};

describe('RF10/RF17 — PlannedVisitCard', () => {
  it('RF10/RF17: exibe nome, data civil sem deslocamento e atividades com e sem descrição', async () => {
    await render(<PlannedVisitCard visit={baseVisit} />);

    expect(screen.getByText('Visita de acompanhamento')).toBeTruthy();
    expect(screen.getByText('01/02/2027')).toBeTruthy();
    expect(
      screen.getByText('• Coleta inicial — Registro previsto no protocolo.'),
    ).toBeTruthy();
    expect(screen.getByText('• Aferição rápida')).toBeTruthy();
  });

  it('RF10/RF17: exibe prefixo explícito para diferenciar data prevista de agendamento', async () => {
    await render(
      <PlannedVisitCard datePrefix="Data prevista" visit={baseVisit} />,
    );

    expect(screen.getByText('Data prevista: 01/02/2027')).toBeTruthy();
  });

  it('RF10/RF17: trata visita sem atividades e data civil ausente ou inválida', async () => {
    const { rerender } = await render(
      <PlannedVisitCard
        datePrefix="Data prevista"
        visit={{
          ...baseVisit,
          plannedDate: 'data-invalida',
          activities: [],
        }}
      />,
    );

    expect(screen.getByText('Data prevista não informada')).toBeTruthy();
    expect(screen.getByText('Sem atividades previstas.')).toBeTruthy();

    await rerender(
      <PlannedVisitCard
        visit={{
          ...baseVisit,
          plannedDate: '',
          activities: [],
        }}
      />,
    );

    expect(screen.getByText('Data não informada')).toBeTruthy();
  });
});
