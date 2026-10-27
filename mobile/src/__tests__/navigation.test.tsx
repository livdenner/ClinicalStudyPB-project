import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import HomeScreen from '../app/index';
import StudiesScreen from '../app/studies';

describe('navegação inicial', () => {
  it('abre o início e navega para a tela provisória de estudos', async () => {
    await renderRouter(
      {
        index: HomeScreen,
        studies: StudiesScreen,
      },
      { initialUrl: '/' },
    );

    expect(screen.getByText('ClinicalStudyPB')).toBeTruthy();
    expect(screen).toHavePathname('/');

    await testRouter.push('/studies');

    expect(
      await screen.findByText(
        'Esta tela é apenas um destino provisório para demonstrar a navegação.',
      ),
    ).toBeTruthy();
    expect(screen).toHavePathname('/studies');
  });
});
