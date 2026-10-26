import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { PrototiposProvider } from "../context/PrototiposContext";
import { VisaoGeralPage } from "./dashboard/visao-geral";
import { RecrutamentoPage } from "./recrutamento/recrutamento";
import { RelatoriosPage } from "./relatorios/relatorios";
import { VisitasPage } from "./visitas/visitas";

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <AuthProvider>
      <PrototiposProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </PrototiposProvider>
    </AuthProvider>,
  );
}

describe("Protótipos web de Visão geral, Recrutamento, Visitas e Relatórios (T7.2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza a página de Visão geral com indicadores, progresso dos estudos e pendências", () => {
    renderWithProviders(<VisaoGeralPage />);

    expect(
      screen.getByRole("heading", { name: "Visão geral (Protótipo)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Progresso dos estudos")).toBeInTheDocument();
    expect(
      screen.getByText("2 avaliações de elegibilidade"),
    ).toBeInTheDocument();
    expect(screen.getByText("Atividades recentes")).toBeInTheDocument();
  });

  it("permite avaliar candidato e incluir candidato elegível no protótipo de Recrutamento", () => {
    renderWithProviders(<RecrutamentoPage />);

    expect(
      screen.getByRole("heading", { name: "Recrutamento (Protótipo)" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Candidato 014"));
    expect(
      screen.getByRole("heading", { name: "Candidato 014" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar avaliação" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Registrar avaliação" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));
    expect(
      screen.getByText("Avaliação registrada com sucesso."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Voltar para candidatos/i));
    fireEvent.click(screen.getByText("Candidato 021"));
    fireEvent.click(screen.getByRole("button", { name: /Incluir no estudo/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar inclusão" }),
    );

    expect(
      screen.getByText("Candidato incluído no estudo como participante."),
    ).toBeInTheDocument();
  });

  it("permite agendar visita e registrar acompanhamento no protótipo de Visitas", () => {
    renderWithProviders(<VisitasPage />);

    expect(
      screen.getByRole("heading", { name: "Visitas (Protótipo)" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Agendar visita/i }));
    expect(
      screen.getByRole("dialog", { name: "Agendar visita" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    fireEvent.click(screen.getByText("Avaliação inicial"));
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar acompanhamento" }),
    );

    const textarea = screen.getByPlaceholderText(
      "Descreva o registro da visita...",
    );
    fireEvent.change(textarea, {
      target: { value: "Visita realizada conforme protocolo." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar registro" }));

    expect(
      screen.getByText("Acompanhamento registrado com sucesso."),
    ).toBeInTheDocument();
  });

  it("renderiza indicadores, funil de recrutamento e resumo por estudo em Relatórios", () => {
    renderWithProviders(<RelatoriosPage />);

    expect(
      screen.getByRole("heading", { name: "Relatórios (Protótipo)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Funil de recrutamento")).toBeInTheDocument();
    expect(screen.getByText("Situação das visitas")).toBeInTheDocument();
    expect(screen.getByText("Resumo por estudo")).toBeInTheDocument();
  });
});
