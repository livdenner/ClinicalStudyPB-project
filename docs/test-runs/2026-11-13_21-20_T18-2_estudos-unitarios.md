- **Terminou em:** 2026-11-13 21:20

| Teste | Resultado | Observação |
|---|---|---|
| `StudyServiceTest.advanceStatusAllowsOnlyTheNextState` | Passou |  |
| `StudyServiceTest.advanceStatusRejectsSkippedAndRepeatedTransitionsWithoutChangingState` | Passou |  |
| `StudyServiceTest.advanceStatusRejectsUnknownStudy` | Passou |  |
| `StudyServiceTest.cancellationDelegatesPendingVisitsWithinStatusTransaction` | Passou |  |
| `StudyServiceTest.cancellationDuringExecutionCannotBeRestored` | Passou |  |
| `StudyServiceTest.cancellationRequiresReasonAndStaleStatusIsRejected` | Passou |  |
| `StudyServiceTest.cancelledRecruitmentCanReturnOnlyToRecruitment` | Passou |  |
| `StudyServiceTest.closedStudyRequiresEveryScheduledVisitToHaveAnOutcome` | Passou |  |
| `StudyServiceTest.createStudyAcceptsParticipantLimitBoundaries(int)[1]` | Passou |  |
| `StudyServiceTest.createStudyAcceptsParticipantLimitBoundaries(int)[2]` | Passou |  |
| `StudyServiceTest.createStudyPersistsTrimmedDataForResearcher` | Passou |  |
| `StudyServiceTest.createStudyRejectsEndDateBeforeStartDate` | Passou |  |
| `StudyServiceTest.createStudyRejectsInactiveResearcher` | Passou |  |
| `StudyServiceTest.createStudyRejectsParticipantLimitOutsideContract(Integer)[1]` | Passou |  |
| `StudyServiceTest.createStudyRejectsParticipantLimitOutsideContract(Integer)[2]` | Passou |  |
| `StudyServiceTest.createStudyRejectsParticipantLimitOutsideContract(Integer)[3]` | Passou |  |
| `StudyServiceTest.createStudyRejectsParticipantLimitOutsideContract(Integer)[4]` | Passou |  |
| `StudyServiceTest.createStudyRejectsParticipantLimitOutsideContract(Integer)[5]` | Passou |  |
| `StudyServiceTest.createStudyRejectsUnknownResponsibleUser` | Passou |  |
| `StudyServiceTest.createStudyRejectsUserWithoutResearcherRole` | Passou |  |
| `StudyServiceTest.executionIsBlockedUntilParticipantModuleProvidesReadiness` | Passou |  |
| `StudyServiceTest.getStudyRejectsUnknownId` | Passou |  |
| `StudyServiceTest.listAndGetStudiesReturnRepositoryResults` | Passou |  |
| `StudyServiceTest.otherResearcherCannotUpdateOrChangeStatus` | Passou |  |
| `StudyServiceTest.recruitmentCanReturnToPlanning` | Passou |  |
| `StudyServiceTest.recruitmentIsBlockedUntilCriteriaModuleProvidesReadiness` | Passou |  |
| `StudyServiceTest.updateStudyAcceptsParticipantLimitBoundaries(int)[1]` | Passou |  |
| `StudyServiceTest.updateStudyAcceptsParticipantLimitBoundaries(int)[2]` | Passou |  |
| `StudyServiceTest.updateStudyChangesManagedEntityAfterValidation` | Passou |  |
| `StudyServiceTest.updateStudyKeepsOriginalDataWhenValidationFails` | Passou |  |
| `StudyServiceTest.updateStudyRejectsInvalidParticipantLimitWithoutChangingData(Integer)[1]` | Passou |  |
| `StudyServiceTest.updateStudyRejectsInvalidParticipantLimitWithoutChangingData(Integer)[2]` | Passou |  |
| `StudyServiceTest.updateStudyRejectsInvalidParticipantLimitWithoutChangingData(Integer)[3]` | Passou |  |
| `StudyServiceTest.updateStudyRejectsInvalidParticipantLimitWithoutChangingData(Integer)[4]` | Passou |  |
| `StudyServiceTest.updateStudyRejectsInvalidParticipantLimitWithoutChangingData(Integer)[5]` | Passou |  |
| **Total de testes: 35** | **Passaram: 35 (100,0%); falharam: 0 (0,0%)** | |
