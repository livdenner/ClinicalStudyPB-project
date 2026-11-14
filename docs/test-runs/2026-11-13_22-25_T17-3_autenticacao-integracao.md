- **Terminou em:** 2026-11-13 22:25

| Teste | Resultado | Observação |
|---|---|---|
| `ActivationIntegrationTest.invalidActivationPayloadReturnsActivationInvalidProblemDetail` | Passou | |
| `ActivationIntegrationTest.invalidInitialPasswordKeepsInvitePendingAndAllowsRetry` | Passou | |
| `ActivationIntegrationTest.settingInitialPasswordConsumesCodeUnlocksSessionAndAllowsLogin` | Passou | |
| `ActivationIntegrationTest.regularUserPasswordChangeRequiresCurrentPasswordAndUpdatesLogin` | Passou | |
| `ActivationIntegrationTest.replacedCodeIsRejected` | Passou | |
| `ActivationIntegrationTest.activationWaitsForConcurrentInviteReplacementAndRejectsPreviousCode` | Passou | |
| `ActivationIntegrationTest.invalidCodeOrUnknownEmailDoesNotActivateAccount` | Passou | |
| `ActivationIntegrationTest.validCodeActivatesAccountButKeepsPasswordAndCodePending` | Passou | |
| `ActivationIntegrationTest.unicodePasswordWithin72CharactersCanBeUsedForLogin` | Passou | |
| `ActivationIntegrationTest.expiredCodeIsGoneAndDoesNotActivateAccount` | Passou | |
| `ActivationIntegrationTest.passwordChangeWithoutTokenIsUnauthorized` | Passou | |
| `AuthIntegrationTest.loginReturnsBearerTokenAndPublicUserData_CA02_1` | Passou | |
| `AuthIntegrationTest.loginIgnoresEmailCase` | Passou | |
| `AuthIntegrationTest.tokenIssuedAtLoginGrantsAccessToProtectedEndpoint_CA02_1` | Passou | |
| `AuthIntegrationTest.logoutWithoutTokenIsUnauthorized` | Passou | |
| `AuthIntegrationTest.tokenWithForgedAdministratorRoleIsUnauthorized_CA02_5` | Passou | |
| `AuthIntegrationTest.logoutWithValidTokenReturnsNoContent` | Passou | |
| `AuthIntegrationTest.wrongPasswordReturnsGenericUnauthorized_CA02_2` | Passou | |
| `AuthIntegrationTest.tokenSignedWithAnotherKeyIsUnauthorized_CA02_5` | Passou | |
| `AuthIntegrationTest.malformedTokenIsUnauthorized_CA02_5` | Passou | |
| `AuthIntegrationTest.inactiveUserCannotLoginWithCorrectPassword_CA02_3` | Passou | |
| `AuthIntegrationTest.expiredTokenIsUnauthorized_CA02_5` | Passou | |
| `AuthIntegrationTest.userDeactivatedByAdministratorCannotLoginAnymore_CA01_4` | Passou | |
| `AuthIntegrationTest.invalidLoginBodyReturnsFieldErrors` | Passou | |
| `AuthIntegrationTest.unknownEmailAndWrongPasswordReturnTheSameBody_CA02_2` | Passou | |
| `AuthIntegrationTest.requestWithoutTokenIsUnauthorized_CA02_5` | Passou | |
| **Total de testes: 26** | **Passaram: 26 (100%); falharam: 0 (0%)** | |
