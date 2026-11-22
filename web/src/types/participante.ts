export interface ParticipanteApi {
    id: number;
    studyId: number;
    candidateId: number;
    candidateName: string;
    includedAt: string;
    status: "ACTIVE" | "WITHDRAWN";
    withdrawal?: {
        reason: string;
        withdrawnAt: string;
        withdrawnByUserId: number;
        cancelledVisitCount: number;
    };
}
