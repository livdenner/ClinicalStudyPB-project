package clinicalstudypb.participants;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Confere o contrato HTTP, as integrações reais e a ausência de gravações parciais de RF11.
 *
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
class ParticipantIntegrationTest extends ParticipantIntegrationSupport {

    @Test
    void inclusionPersistsAuditAndReturnsContractPayloadAndUsableLocation() throws Exception {
        ResultActions response = include(study.getId(), candidateId).andExpect(status().isCreated())
                .andExpect(jsonPath("$.studyId").value(study.getId()))
                .andExpect(jsonPath("$.candidateId").value(candidateId))
                .andExpect(jsonPath("$.candidateName").value("Ana Silva"))
                .andExpect(jsonPath("$.includedAt").value(NOW.toString()));
        JsonNode payload = objectMapper.readTree(response.andReturn().getResponse().getContentAsString());
        assertEquals(5, payload.size());
        Long id = payload.get("id").asLong();
        String location = studyPath(study.getId()) + "/participants/" + id;
        response.andExpect(header().string(HttpHeaders.LOCATION, location));
        Participant persisted = participantRepository.findById(id).orElseThrow();
        assertEquals(coordinator.getId(), persisted.getIncludedBy());
        assertEquals(NOW, persisted.getIncludedAt());
        assertTrue(consentRepository.findById(candidateId).orElseThrow().isLockedAfterInclusion());
        for (String token : new String[] {coordinatorToken, researcherToken}) {
            String detail = mockMvc.perform(get(location).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertEquals(payload, objectMapper.readTree(detail));
            mockMvc.perform(get(studyPath(study.getId()) + "/participants")
                            .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(id));
        }
    }

    @ParameterizedTest
    @EnumSource(value = EligibilityStatus.class, names = {"PENDING", "INELIGIBLE"})
    void incompleteOrNegativeEligibilityReturnsConflictAndPreservesAllRecords(EligibilityStatus eligibility)
            throws Exception {
        Long rejected = candidate(study, "Candidata pendente", eligibility, ConsentDecision.GRANTED);
        DatabaseSnapshot before = snapshot();
        include(study.getId(), rejected).andExpect(status().isConflict());
        assertEquals(before, snapshot());
    }

    @ParameterizedTest
    @NullSource
    @EnumSource(value = ConsentDecision.class, names = "DECLINED")
    void absentOrDeclinedConsentReturnsConflictWithoutCreatingOrLockingAnything(ConsentDecision consent)
            throws Exception {
        Long rejected = candidate(study, "Sem consentimento", EligibilityStatus.ELIGIBLE, consent);
        DatabaseSnapshot before = snapshot();
        include(study.getId(), rejected).andExpect(status().isConflict());
        assertEquals(before, snapshot());
    }

    @Test
    void duplicateInclusionDoesNotConsumeAnotherPlaceOrChangeAudit() throws Exception {
        includeSuccessfully(study.getId(), candidateId);
        DatabaseSnapshot before = snapshot();
        include(study.getId(), candidateId).andExpect(status().isConflict());
        assertEquals(before, snapshot());
        assertEquals(1, participantRepository.countByStudyId(study.getId()));
    }

    @Test
    void lastPlaceCanBeFilledButNextCandidateIsRejectedWithoutLockingConsent() throws Exception {
        Long second = candidate(study, "Bruna", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        Long third = candidate(study, "Carla", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        includeSuccessfully(study.getId(), candidateId);
        includeSuccessfully(study.getId(), second);
        DatabaseSnapshot before = snapshot();
        include(study.getId(), third).andExpect(status().isConflict());
        assertEquals(before, snapshot());
        assertEquals(2, participantRepository.countByStudyId(study.getId()));
        assertFalse(consentRepository.findById(third).orElseThrow().isLockedAfterInclusion());
    }

    @Test
    void failedInsertRollsBackAlreadyFlushedConsentLockAndLeavesPlaceAvailable() throws Exception {
        DatabaseSnapshot before = snapshot();
        jdbc.execute("ALTER TABLE participants ADD CONSTRAINT test_reject_participant CHECK (candidate_id <> "
                + candidateId + ")");
        try {
            include(study.getId(), candidateId).andExpect(status().isConflict());
            assertEquals(before, snapshot());
            assertFalse(consentRepository.findById(candidateId).orElseThrow().isLockedAfterInclusion());
        } finally {
            jdbc.execute("ALTER TABLE participants DROP CONSTRAINT test_reject_participant");
        }
        includeSuccessfully(study.getId(), candidateId);
        assertEquals(1, participantRepository.countByStudyId(study.getId()));
    }

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"PLANNING", "EXECUTION", "CLOSED", "CANCELLED"})
    void inclusionOutsideRecruitmentReturnsConflictWithoutPartialWrites(StudyStatus state) throws Exception {
        if (state == StudyStatus.EXECUTION || state == StudyStatus.CLOSED) {
            Long seed = candidate(study, "Participante inicial", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
            includeSuccessfully(study.getId(), seed);
            transition(study.getId(), StudyStatus.EXECUTION, StudyStatus.RECRUITMENT).andExpect(status().isOk());
            if (state == StudyStatus.CLOSED) {
                transition(study.getId(), StudyStatus.CLOSED, StudyStatus.EXECUTION).andExpect(status().isOk());
            }
        } else {
            transition(study.getId(), state, StudyStatus.RECRUITMENT).andExpect(status().isOk());
        }
        DatabaseSnapshot before = snapshot();
        include(study.getId(), candidateId).andExpect(status().isConflict());
        assertEquals(before, snapshot());
    }

    @Test
    void executionRequiresRealParticipantAndThenBlocksRegistrationInclusionConsentAndReevaluation() throws Exception {
        Long next = candidate(study, "Próxima candidata", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        DatabaseSnapshot before = snapshot();
        transition(study.getId(), StudyStatus.EXECUTION, StudyStatus.RECRUITMENT).andExpect(status().isConflict());
        assertEquals(before, snapshot());
        includeSuccessfully(study.getId(), candidateId);
        transition(study.getId(), StudyStatus.EXECUTION, StudyStatus.RECRUITMENT).andExpect(status().isOk());
        DatabaseSnapshot included = snapshot();
        include(study.getId(), next).andExpect(status().isConflict());
        consent(study.getId(), candidateId, ConsentDecision.DECLINED).andExpect(status().isConflict());
        evaluate(study.getId(), candidateId, false).andExpect(status().isConflict());
        mockMvc.perform(post(studyPath(study.getId()) + "/candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Nova candidata\",\"age\":42,"
                                + "\"email\":\"nova.candidata@clinicalstudypb.test\","
                                + "\"phone\":\"(83) 99999-0000\"}"))
                .andExpect(status().isConflict());
        assertEquals(included, snapshot());
    }

    @Test
    void includedCandidateCannotChangeConsentOrEligibilityDuringRecruitmentEither() throws Exception {
        includeSuccessfully(study.getId(), candidateId);
        DatabaseSnapshot before = snapshot();
        consent(study.getId(), candidateId, ConsentDecision.DECLINED).andExpect(status().isConflict());
        evaluate(study.getId(), candidateId, false).andExpect(status().isConflict());
        assertEquals(before, snapshot());
    }

    @Test
    void listsAreIsolatedByStudyAndEmptyStudyReturnsEmptyArray() throws Exception {
        Study other = openStudy("Outro estudo", 1);
        Study empty = openStudy("Sem inclusões", 1);
        Long otherCandidate = candidate(other, "Outra candidata", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        Long firstId = includeSuccessfully(study.getId(), candidateId).get("id").asLong();
        Long otherId = includeSuccessfully(other.getId(), otherCandidate).get("id").asLong();
        mockMvc.perform(get(studyPath(study.getId()) + "/participants")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(firstId))
                .andExpect(jsonPath("$[0].candidateId").value(candidateId));
        mockMvc.perform(get(studyPath(other.getId()) + "/participants")
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(otherId))
                .andExpect(jsonPath("$[0].candidateId").value(otherCandidate));
        mockMvc.perform(get(studyPath(empty.getId()) + "/participants")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(get(studyPath(other.getId()) + "/participants/" + firstId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void candidateFromAnotherStudyAndMissingResourcesReturnNotFoundWithoutWrites() throws Exception {
        Study other = openStudy("Outro estudo", 2);
        DatabaseSnapshot before = snapshot();
        include(other.getId(), candidateId).andExpect(status().isNotFound());
        include(study.getId(), Long.MAX_VALUE).andExpect(status().isNotFound());
        include(Long.MAX_VALUE, candidateId).andExpect(status().isNotFound());
        mockMvc.perform(get(studyPath(Long.MAX_VALUE) + "/participants")
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(studyPath(study.getId()) + "/participants/" + Long.MAX_VALUE)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(studyPath(Long.MAX_VALUE) + "/participants/" + Long.MAX_VALUE)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());
        assertEquals(before, snapshot());
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"ADMINISTRATOR", "PARTICIPANT", "RESEARCHER"})
    void roleMatrixChecksAllRoutesAndDeniedInclusionDoesNotPersist(UserRole role) throws Exception {
        Long participantId = includeSuccessfully(study.getId(), candidateId).get("id").asLong();
        Long next = candidate(study, "Próxima candidata", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        User user = saveUser("Outro perfil", "participant.other@test.local", role);
        String token = tokenFor(user.getEmail());
        DatabaseSnapshot before = snapshot();
        mockMvc.perform(post(inclusionPath(study.getId(), next)).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
        int expectedRead = role == UserRole.RESEARCHER ? 200 : 403;
        mockMvc.perform(get(studyPath(study.getId()) + "/participants")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))).andExpect(status().is(expectedRead));
        mockMvc.perform(get(studyPath(study.getId()) + "/participants/" + participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))).andExpect(status().is(expectedRead));
        assertEquals(before, snapshot());
    }

    @Test
    void anonymousRequestsAreUnauthorizedAndDoNotPersist() throws Exception {
        Long participantId = includeSuccessfully(study.getId(), candidateId).get("id").asLong();
        Long next = candidate(study, "Próxima candidata", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        DatabaseSnapshot before = snapshot();
        mockMvc.perform(post(inclusionPath(study.getId(), next))).andExpect(status().isUnauthorized());
        mockMvc.perform(get(studyPath(study.getId()) + "/participants")).andExpect(status().isUnauthorized());
        mockMvc.perform(get(studyPath(study.getId()) + "/participants/" + participantId))
                .andExpect(status().isUnauthorized());
        assertEquals(before, snapshot());
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3})
    void limitCanEqualIncludedCountButCannotBeReducedBelowIt(int proposedLimit) throws Exception {
        Long other = candidate(study, "Bruna", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        includeSuccessfully(study.getId(), candidateId);
        includeSuccessfully(study.getId(), other);
        DatabaseSnapshot before = snapshot();
        mockMvc.perform(put(studyPath(study.getId())).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("title", study.getTitle(),
                                "objective", study.getObjective(), "responsibleUserId", researcher.getId(),
                                "startDate", "2027-01-01", "endDate", "2027-12-31",
                                "participantLimit", proposedLimit))))
                .andExpect(status().is(proposedLimit < 2 ? 409 : 200));
        assertEquals(proposedLimit < 2 ? 2 : proposedLimit,
                studyRepository.findById(study.getId()).orElseThrow().getParticipantLimit());
        assertEquals(before, snapshot());
    }

    @Test
    void cancelledCandidateCannotBeIncludedAndIncludedCandidateCannotBeCancelled() throws Exception {
        Long cancelled = candidate(study, "Carla Mendes", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        mockMvc.perform(post(studyPath(study.getId()) + "/candidates/" + cancelled + "/cancellation")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Desistiu do estudo\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(post(inclusionPath(study.getId(), cancelled))
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CANDIDATE_CANCELLED"));

        includeSuccessfully(study.getId(), candidateId);
        mockMvc.perform(post(studyPath(study.getId()) + "/candidates/" + candidateId + "/cancellation")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Tentativa após inclusão\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CANDIDATE_ALREADY_INCLUDED"));
    }

    @Test
    void swaggerDocumentsAllParticipantOperationsAndResponseSchema() throws Exception {
        mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/studies/{studyId}/candidates/{candidateId}/inclusion'].post")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/studies/{studyId}/candidates/{candidateId}/inclusion']"
                        + ".post.responses['201'].headers.Location.schema.type").value("string"))
                .andExpect(jsonPath("$.paths['/api/studies/{studyId}/candidates/{candidateId}/inclusion']"
                        + ".post.requestBody").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/studies/{studyId}/participants'].get").exists())
                .andExpect(jsonPath("$.paths['/api/studies/{studyId}/participants/{participantId}'].get").exists())
                .andExpect(jsonPath("$.components.schemas.Participant.properties.candidateName").exists())
                .andExpect(jsonPath("$.components.schemas.Participant.required.length()").value(5));
    }
}
