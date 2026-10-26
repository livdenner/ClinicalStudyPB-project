import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Check, Search, X } from "lucide-react";
import {
  initialCandidates,
  initialParticipants,
  initialStudies,
  initialVisits,
  type CandidatoPrototipo,
  type EstudoPrototipo,
  type ParticipantePrototipo,
  type StatusCandidato,
  type VisitaPrototipo,
} from "../data/prototipos-mock";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type PrototiposContextValue = {
  studies: EstudoPrototipo[];
  candidates: CandidatoPrototipo[];
  participants: ParticipantePrototipo[];
  visits: VisitaPrototipo[];
  evaluateCandidate: (
    id: number,
    status: StatusCandidato,
    notes: string,
  ) => void;
  includeCandidate: (candidate: CandidatoPrototipo) => void;
  addVisit: (visit: Omit<VisitaPrototipo, "id">) => void;
  completeVisit: (id: number, notes: string) => void;
  flash: (message: string) => void;
};

const PrototiposContext = createContext<PrototiposContextValue | null>(null);

export function PrototiposProvider({ children }: { children: ReactNode }) {
  const [studies, setStudies] = useState<EstudoPrototipo[]>(() =>
    loadFromStorage("cs-studies", initialStudies),
  );
  const [candidates, setCandidates] = useState<CandidatoPrototipo[]>(() =>
    loadFromStorage("cs-candidates", initialCandidates),
  );
  const [participants, setParticipants] = useState<ParticipantePrototipo[]>(
    () => loadFromStorage("cs-participants", initialParticipants),
  );
  const [visits, setVisits] = useState<VisitaPrototipo[]>(() =>
    loadFromStorage("cs-visits", initialVisits),
  );
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("cs-studies", JSON.stringify(studies));
    } catch {
      // ignora erro de armazenamento
    }
  }, [studies]);

  useEffect(() => {
    try {
      localStorage.setItem("cs-candidates", JSON.stringify(candidates));
    } catch {
      // ignora erro de armazenamento
    }
  }, [candidates]);

  useEffect(() => {
    try {
      localStorage.setItem("cs-participants", JSON.stringify(participants));
    } catch {
      // ignora erro de armazenamento
    }
  }, [participants]);

  useEffect(() => {
    try {
      localStorage.setItem("cs-visits", JSON.stringify(visits));
    } catch {
      // ignora erro de armazenamento
    }
  }, [visits]);

  function flash(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2800);
  }

  function evaluateCandidate(
    id: number,
    status: StatusCandidato,
    notes: string,
  ) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status, notes } : c)),
    );
    flash("Avaliação registrada com sucesso.");
  }

  function includeCandidate(candidate: CandidatoPrototipo) {
    setParticipants((prev) => {
      const nextId = Math.max(...prev.map((x) => x.id), 0) + 1;
      const novoParticipante: ParticipantePrototipo = {
        id: nextId,
        name: `Participante ${String(prev.length + 35).padStart(3, "0")}`,
        studyId: candidate.studyId,
        status: "Em acompanhamento",
        origin: candidate.name,
      };
      return [...prev, novoParticipante];
    });
    setStudies((prev) =>
      prev.map((s) =>
        s.id === candidate.studyId
          ? { ...s, participants: s.participants + 1 }
          : s,
      ),
    );
    flash("Candidato incluído no estudo como participante.");
  }

  function addVisit(visit: Omit<VisitaPrototipo, "id">) {
    setVisits((prev) => {
      const nextId = Math.max(...prev.map((x) => x.id), 0) + 1;
      return [...prev, { ...visit, id: nextId }];
    });
    flash("Visita agendada com sucesso.");
  }

  function completeVisit(id: number, notes: string) {
    setVisits((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, status: "Realizada", notes } : v,
      ),
    );
    flash("Acompanhamento registrado com sucesso.");
  }

  return (
    <PrototiposContext.Provider
      value={{
        studies,
        candidates,
        participants,
        visits,
        evaluateCandidate,
        includeCandidate,
        addVisit,
        completeVisit,
        flash,
      }}
    >
      {children}
      {toast && (
        <div
          role="status"
          className="fixed right-6 bottom-6 z-50 flex items-center gap-2.5 rounded-xl bg-[#1b2d40] px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#16804B] text-white">
            <Check size={14} strokeWidth={2.5} aria-hidden="true" />
          </span>
          {toast}
        </div>
      )}
    </PrototiposContext.Provider>
  );
}

export function usePrototipos() {
  const ctx = useContext(PrototiposContext);
  if (!ctx) {
    throw new Error(
      "usePrototipos deve ser utilizado dentro de um PrototiposProvider",
    );
  }
  return ctx;
}

export function PrototipoBadge({ children }: { children: ReactNode }) {
  const text = String(children).toLowerCase();
  const classes =
    text.includes("não") || text.includes("inativ")
      ? "bg-[#FDEAEA] text-[#B42318]"
      : text.includes("pend") || text.includes("recrut")
        ? "bg-[#FEF2DA] text-[#946200]"
        : text.includes("eleg") ||
            text.includes("realiz") ||
            text.includes("conclu") ||
            text.includes("encerr") ||
            text.includes("ativ")
          ? "bg-[#E4F4E9] text-[#16804B]"
          : "bg-[#E9F2FD] text-[#2563B8]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}
    >
      {children}
    </span>
  );
}

export function PrototipoStats({
  items,
}: {
  items: { label: string; value: string | number; tone?: string }[];
}) {
  const letters = ["E", "R", "P", "V"];
  const toneClasses: Record<string, string> = {
    default: "bg-[#E9F2FD] text-[#2563B8]",
    amber: "bg-[#FEF2DA] text-[#946200]",
    blue: "bg-[#E6F4F2] text-[#126966]",
    green: "bg-[#E4F4E9] text-[#16804B]",
  };

  return (
    <div className="grid grid-cols-4 gap-3.5 max-[1000px]:grid-cols-2 max-[520px]:grid-cols-1">
      {items.map((item, idx) => (
        <div
          key={item.label}
          className="flex min-w-0 items-start gap-3 rounded-xl border border-[#dce5ed] bg-white p-4"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
              toneClasses[item.tone || "default"] || toneClasses.default
            }`}
            aria-hidden="true"
          >
            {letters[idx] || "•"}
          </span>
          <div className="flex min-w-0 flex-col">
            <strong className="text-2xl leading-none font-bold text-[#1b2d40]">
              {item.value}
            </strong>
            <p className="mt-1 text-sm font-medium text-[#52677c]">
              {item.label}
            </p>
            <small className="mt-0.5 text-xs text-[#64748b]">
              Dados do protótipo
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PrototipoEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f5f9] text-[#52677c]">
        <Search size={18} aria-hidden="true" />
      </div>
      <strong className="text-sm font-semibold text-[#1b2d40]">
        Nenhum registro encontrado
      </strong>
      <p className="text-xs text-[#52677c]">{text}</p>
    </div>
  );
}

export function PrototipoModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#dce5ed] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#dce5ed] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1b2d40]">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#52677c]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#52677c] hover:bg-slate-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
