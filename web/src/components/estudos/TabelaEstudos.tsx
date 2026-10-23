import { Table } from "@heroui/react";
import { Pencil } from "lucide-react";
import type { Estudo, StatusEstudo } from "../../types/estudo";
import { formatarPeriodo } from "../../utils/estudos";
import { BarraProgressoParticipantes } from "./BarraProgressoParticipantes";

type TabelaEstudosProps = {
  estudos: Estudo[];
  onEditar?: (estudo: Estudo) => void;
};

const STATUS_STYLES: Record<StatusEstudo, string> = {
  Planejamento: "bg-[#edf0f5] text-[#536579]",
  Recrutamento: "bg-[#FEF2DA] text-[#946200]",
  "Em execução": "bg-[#E6F4F2] text-[#126966]", //deve ter aspas pois tem espaço entre as palvras
  Encerrado: "bg-[#E4F4E9] text-[#16804B]",
};

export function TabelaEstudos({ estudos, onEditar }: TabelaEstudosProps) {
  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <Table.ScrollContainer>
          <Table.Content
            aria-label="Lista de estudos clínicos"
            className="w-full min-w-[760px] border-collapse text-left text-sm"
          >
            <Table.Header>
              <Table.Column
                id="estudo"
                className="bg-[#177470] px-5 py-3.5 text-xs font-semibold text-white"
              >
                Estudo
              </Table.Column>

              <Table.Column
                id="responsavel"
                className="bg-[#177470] px-5 py-3.5 text-xs font-semibold text-white"
              >
                Responsável
              </Table.Column>

              <Table.Column
                id="participantes"
                className="bg-[#177470] px-5 py-3.5 text-xs font-semibold text-white"
              >
                Participantes
              </Table.Column>

              <Table.Column
                id="periodo"
                className="bg-[#177470] px-5 py-3.5 text-xs font-semibold text-white"
              >
                Período
              </Table.Column>

              <Table.Column
                id="status"
                className="bg-[#177470] px-5 py-3.5 text-xs font-semibold text-white"
              >
                Status
              </Table.Column>

              {onEditar && (
                <Table.Column
                  id="editar"
                  className="bg-[#177470] px-5 py-3.5 text-xs font-semibold text-white"
                >
                  Editar
                </Table.Column>
              )}
            </Table.Header>

            <Table.Body>
              {estudos.map((estudo) => (
                <Table.Row
                  key={estudo.id}
                  id={estudo.id}
                  className="border-b border-[#edf1f5] transition-colors hover:bg-[#E6F4F2]"
                >
                  <Table.Cell className="px-5 py-4 font-semibold text-[#1b2d40]">
                    {estudo.titulo}
                  </Table.Cell>

                  <Table.Cell className="px-5 py-4 text-[#52677c]">
                    {estudo.responsavel}
                  </Table.Cell>

                  <Table.Cell className="px-5 py-4">
                    <BarraProgressoParticipantes
                      tituloEstudo={estudo.titulo}
                      participantes={estudo.participantes}
                      limite={estudo.limiteParticipantes}
                    />
                  </Table.Cell>

                  <Table.Cell className="whitespace-nowrap px-5 py-4 text-[#52677c]">
                    {formatarPeriodo(estudo.dataInicio, estudo.dataFim)}
                  </Table.Cell>

                  <Table.Cell className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[estudo.status]}`}
                    >
                      {estudo.status}
                    </span>
                  </Table.Cell>

                  {onEditar && (
                    <Table.Cell className="px-5 py-4">
                      <button
                        type="button"
                        aria-label={`Editar estudo: ${estudo.titulo}`}
                        onClick={() => onEditar(estudo)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#75899d] transition-colors hover:bg-[#e4f3f1] hover:text-[#177470]"
                      >
                        <Pencil
                          size={15}
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </button>
                    </Table.Cell>
                  )}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {estudos.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
          <strong className="text-sm font-semibold text-[#1b2d40]">
            Registro não encontrado
          </strong>

          <span className="text-sm text-[#71849a]">
            Procure ajustar os filtros ou criar um novo estudo.
          </span>
        </div>
      )}
    </div>
  );
}
