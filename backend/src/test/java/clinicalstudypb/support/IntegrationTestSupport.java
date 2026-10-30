package clinicalstudypb.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.infrastructure.StudyRepository;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import clinicalstudypb.users.infrastructure.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base dos testes de integração: sobe a aplicação completa (Spring Security, JWT real e
 * migrações Flyway) sobre um PostgreSQL descartável e limpa o banco antes de cada teste.
 *
 * <p>O contêiner é único para todas as classes de teste, assim o contexto do Spring fica em
 * cache entre elas e o banco sobe uma só vez; o Testcontainers o remove ao final da execução.
 *
 * @author Júlia Pamplona
 * @since 2026-10-30
 * @version 0.0.1
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class IntegrationTestSupport {

    /** Senha de todas as contas criadas pelos testes. */
    protected static final String PASSWORD = "Senha@Teste2026";

    private static final String JWT_SECRET = base64("chave-de-teste-integracao-32-byt");
    private static final String LOGIN_URL = "/api/v1/auth/login";

    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18");

    static {
        POSTGRES.start();
    }

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected StudyRepository studyRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", POSTGRES::getJdbcUrl);
        registry.add("DB_USER", POSTGRES::getUsername);
        registry.add("DB_PASSWORD", POSTGRES::getPassword);
        registry.add("JWT_SECRET_BASE64", () -> JWT_SECRET);
        registry.add("JWT_EXPIRATION_SECONDS", () -> "3600");
    }

    @BeforeEach
    void cleanDatabase() {
        studyRepository.deleteAll();
        userRepository.deleteAll();
    }

    /** Grava um usuário ativo com a senha {@link #PASSWORD}. */
    protected User saveUser(String name, String email, UserRole role) {
        return userRepository.save(new User(name, email, passwordEncoder.encode(PASSWORD), role));
    }

    /** Envia o login pela API, como o front-end faz. */
    protected ResultActions login(String email, String password) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginBody(email, password));
        return mockMvc.perform(post(LOGIN_URL).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    /** Faz login com {@link #PASSWORD} e devolve o token emitido. */
    protected String tokenFor(String email) throws Exception {
        String response = login(email, PASSWORD)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(response).get("accessToken").asText();
    }

    /** Valor do cabeçalho Authorization para o token informado. */
    protected static String bearer(String token) {
        return "Bearer " + token;
    }

    protected static String base64(String rawSecret) {
        return Base64.getEncoder().encodeToString(rawSecret.getBytes(StandardCharsets.UTF_8));
    }

    private record LoginBody(String email, String password) {
    }
}
