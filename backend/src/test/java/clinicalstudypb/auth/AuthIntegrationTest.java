package clinicalstudypb.auth;

import static org.hamcrest.Matchers.emptyOrNullString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.auth.application.JwtService;
import clinicalstudypb.auth.infrastructure.JwtConfiguration;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

/**
 * Verifica login, logout e a proteção dos endpoints com a aplicação completa:
 * Spring Security real, JWT real e PostgreSQL descartável com as migrações Flyway.
 *
 * @author Júlia Pamplona
 * @since 2026-10-27
 * @version 0.0.1
 */
class AuthIntegrationTest extends IntegrationTestSupport {

    private static final String OTHER_SECRET = base64("outra-chave-que-nao-e-do-backend");
    private static final String RESEARCHER_EMAIL = "pesquisador@clinicalstudypb.test";
    private static final String ADMIN_EMAIL = "administrador@clinicalstudypb.test";
    private static final String LOGIN_URL = "/api/v1/auth/login";
    private static final String LOGOUT_URL = "/api/v1/auth/logout";
    private static final String PROTECTED_URL = "/api/studies";

    @Autowired
    private JwtEncoder jwtEncoder;

    private User researcher;

    @BeforeEach
    void setUp() {
        researcher = saveUser("Pesquisador Teste", RESEARCHER_EMAIL, UserRole.RESEARCHER);
        saveUser("Administrador Teste", ADMIN_EMAIL, UserRole.ADMINISTRATOR);
    }

    @Test
    void loginReturnsBearerTokenAndPublicUserData_CA02_1() throws Exception {
        login(RESEARCHER_EMAIL, PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", not(emptyOrNullString())))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(3600))
                .andExpect(jsonPath("$.user.email").value(RESEARCHER_EMAIL))
                .andExpect(jsonPath("$.user.role").value("RESEARCHER"))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.user.password").doesNotExist());
    }

    @Test
    void tokenIssuedAtLoginGrantsAccessToProtectedEndpoint_CA02_1() throws Exception {
        String token = tokenFor(RESEARCHER_EMAIL);

        mockMvc.perform(get(PROTECTED_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void loginIgnoresEmailCase() throws Exception {
        login("Pesquisador@ClinicalStudyPB.TEST", PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(RESEARCHER_EMAIL));
    }

    @Test
    void wrongPasswordReturnsGenericUnauthorized_CA02_2() throws Exception {
        login(RESEARCHER_EMAIL, "senha-errada")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.accessToken").doesNotExist());
    }

    @Test
    void unknownEmailAndWrongPasswordReturnTheSameBody_CA02_2() throws Exception {
        String wrongPassword = login(RESEARCHER_EMAIL, "senha-errada")
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String unknownEmail = login("ninguem@clinicalstudypb.test", PASSWORD)
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertEquals(wrongPassword, unknownEmail);
    }

    @Test
    void inactiveUserCannotLoginWithCorrectPassword_CA02_3() throws Exception {
        researcher.deactivate();
        userRepository.save(researcher);

        login(RESEARCHER_EMAIL, PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void userDeactivatedByAdministratorCannotLoginAnymore_CA01_4() throws Exception {
        String adminToken = tokenFor(ADMIN_EMAIL);

        mockMvc.perform(patch("/api/users/{id}/deactivate", researcher.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        login(RESEARCHER_EMAIL, PASSWORD).andExpect(status().isUnauthorized());
    }

    @Test
    void invalidLoginBodyReturnsFieldErrors() throws Exception {
        mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nao-e-email\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'email')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'password')]").exists());
    }

    @Test
    void requestWithoutTokenIsUnauthorized_CA02_5() throws Exception {
        mockMvc.perform(get(PROTECTED_URL))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void malformedTokenIsUnauthorized_CA02_5() throws Exception {
        mockMvc.perform(get(PROTECTED_URL).header(HttpHeaders.AUTHORIZATION, "Bearer nao-e-um-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenWithForgedAdministratorRoleIsUnauthorized_CA02_5() throws Exception {
        String[] parts = tokenFor(RESEARCHER_EMAIL).split("\\.");
        ObjectNode claims = (ObjectNode) objectMapper.readTree(Base64.getUrlDecoder().decode(parts[1]));
        claims.put("role", "ADMINISTRATOR");
        String forgedPayload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(objectMapper.writeValueAsBytes(claims));
        String forged = parts[0] + "." + forgedPayload + "." + parts[2];

        mockMvc.perform(get("/api/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + forged))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenSignedWithAnotherKeyIsUnauthorized_CA02_5() throws Exception {
        JwtConfiguration configuration = new JwtConfiguration();
        SecretKey otherKey = configuration.jwtSecretKey(OTHER_SECRET);
        String foreign = new JwtService(configuration.jwtEncoder(otherKey), 3600).issue(researcher).value();

        mockMvc.perform(get(PROTECTED_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + foreign))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void expiredTokenIsUnauthorized_CA02_5() throws Exception {
        Instant twoHoursAgo = Instant.now().minusSeconds(7200);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("clinicalstudypb")
                .subject(RESEARCHER_EMAIL)
                .issuedAt(twoHoursAgo)
                .expiresAt(twoHoursAgo.plusSeconds(3600))
                .claim("userId", researcher.getId())
                .claim("role", "RESEARCHER")
                .build();
        String expired = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();

        mockMvc.perform(get(PROTECTED_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + expired))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutWithValidTokenReturnsNoContent() throws Exception {
        mockMvc.perform(post(LOGOUT_URL)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(RESEARCHER_EMAIL)))
                .andExpect(status().isNoContent());
    }

    @Test
    void logoutWithoutTokenIsUnauthorized() throws Exception {
        mockMvc.perform(post(LOGOUT_URL)).andExpect(status().isUnauthorized());
    }
}
