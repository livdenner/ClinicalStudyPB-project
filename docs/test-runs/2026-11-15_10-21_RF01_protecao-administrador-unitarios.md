- **Terminou em:** 2026-11-15 10:21

| Teste | Resultado | Observação |
|---|---|---|
| `UserControllerTest.selfAccountChangeIsReportedAsConflictWithContractCode` | Passou | |
| `UserControllerTest.duplicateEmailIsReportedAsConflict` | Passou | |
| `UserControllerTest.invalidBodyIsRejectedBeforeCallingService` | Passou | |
| `UserControllerTest.missingUserIsReportedAsNotFound` | Passou | |
| `UserControllerTest.deactivateReturnsInactiveUser` | Passou | |
| `UserControllerTest.updateAcceptsDetailsAndRole` | Passou | |
| `UserControllerTest.lastActiveAdministratorIsReportedAsConflictWithContractCode` | Passou | |
| `UserControllerTest.deleteReturnsNoContent` | Passou | |
| `UserControllerTest.createReturnsLocationAndNeverExposesPasswordHash` | Passou | |
| `UserServiceTest.getUserRejectsUnknownId` | Passou | |
| `UserServiceTest.delegatingEncoderAcceptsExistingDemoUserHash` | Passou | |
| `UserServiceTest.operationsRejectRemovingLastActiveAdministrator` | Passou | |
| `UserServiceTest.updateUserAllowsAdministratorToEditOwnNameAndEmailKeepingRole` | Passou | |
| `UserServiceTest.updateUserAllowsSameEmailAndChangesDetailsAndRole` | Passou | |
| `UserServiceTest.updateUserRejectsChangingOwnRole` | Passou | |
| `UserServiceTest.deactivateAndReactivateUserWithoutDeletingIt` | Passou | |
| `UserServiceTest.createUserRejectsEmailAlreadyInUseIgnoringCase` | Passou | |
| `UserServiceTest.deleteUserRemovesExistingRecord` | Passou | |
| `UserServiceTest.deleteUserDoesNotRemoveUnknownRecord` | Passou | |
| `UserServiceTest.operationsAllowRemovingAdminStatusWhenAnotherActiveAdministratorRemains` | Passou | |
| `UserServiceTest.createUserNormalizesEmailAndStoresDelegatingBcryptHash` | Passou | |
| `UserServiceTest.updateUserPreservesDataWhenNewEmailIsAlreadyInUse` | Passou | |
| `UserServiceTest.deactivateAndDeleteRejectOwnAccount` | Passou | |
| **Total de testes: 23** | **Passaram: 23 (100%); falharam: 0 (0%)** | |
