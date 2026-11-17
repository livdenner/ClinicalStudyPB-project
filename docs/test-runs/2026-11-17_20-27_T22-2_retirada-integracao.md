- **Terminou em:** 2026-11-17 20:27

| Teste | Resultado | Observação |
|---|---|---|
| `ParticipantWithdrawalIntegrationTest.afterWithdrawalVisitsShowCancellationAndNewScheduleIsRejected` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.closedOrCancelledStudyRejectsWithdrawal(StudyStatus)[1]` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.closedOrCancelledStudyRejectsWithdrawal(StudyStatus)[2]` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.concurrentScheduleAndWithdrawalNeverLeaveFutureVisitScheduled` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.failureWhileCancellingFutureVisitsRollsBackWithdrawal` | Passou | Ajustado: criação da função e do gatilho dentro do `try`, com `DROP ... IF EXISTS` no `finally` (revisão do #89) |
| `ParticipantWithdrawalIntegrationTest.failureWhileSavingWithdrawalRollsBackVisitCancellation` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.invalidReasonReturnsBadRequestWithoutAnyChange(String)[1]` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.invalidReasonReturnsBadRequestWithoutAnyChange(String)[2]` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.invalidReasonReturnsBadRequestWithoutAnyChange(String)[3]` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.invalidReasonReturnsBadRequestWithoutAnyChange(String)[4]` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.invalidReasonReturnsBadRequestWithoutAnyChange(String)[5]` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.onlyCoordinatorCanWithdraw` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.participantOutsideStudyOrUnknownStudyReturnsNotFound` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.secondWithdrawalReturnsConflictAndKeepsFirstRecord` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.simultaneousWithdrawalsRecordOnlyOneAndCancelVisitsOnce` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.visitCancellationOutsideWithdrawalTransactionIsRefused` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.visitScheduledExactlyAtWithdrawalInstantIsNotFutureAndStaysScheduled` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.withdrawalCancelsOnlyFutureScheduledVisitsAndRecordsAudit` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.withdrawalCancelsOnlyVisitsOfTheWithdrawnParticipant` | Passou |  |
| `ParticipantWithdrawalIntegrationTest.withdrawnParticipantKeepsPlaceAndCannotBeIncludedAgain` | Passou |  |
| **Total de testes: 20** | **Passaram: 20 (100,0%); falharam: 0 (0,0%)** | |
