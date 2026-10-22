package clinicalstudypb.users;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.api.UserController;
import clinicalstudypb.users.domain.EmailAlreadyInUseException;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Verifica os contratos HTTP e as respostas da API de usuários.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @Test
    void createReturnsLocationAndNeverExposesPasswordHash() throws Exception {
        User user = new User("Pesquisador", "pesquisador@example.com", "{bcrypt}hash", UserRole.RESEARCHER);
        ReflectionTestUtils.setField(user, "id", 7L);
        when(userService.createUser("Pesquisador", "pesquisador@example.com", "senha-secreta", UserRole.RESEARCHER))
                .thenReturn(user);

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Pesquisador","email":"pesquisador@example.com",
                                 "password":"senha-secreta","role":"RESEARCHER"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/users/7"))
                .andExpect(jsonPath("$.email").value("pesquisador@example.com"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void invalidBodyIsRejectedBeforeCallingService() throws Exception {
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"","email":"invalido","role":"RESEARCHER"}
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(userService);
    }

    @Test
    void duplicateEmailIsReportedAsConflict() throws Exception {
        when(userService.createUser(any(), any(), any(), any()))
                .thenThrow(new EmailAlreadyInUseException("pesquisador@example.com"));

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Pesquisador","email":"pesquisador@example.com",
                                 "password":"senha-secreta","role":"RESEARCHER"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("E-mail já cadastrado: pesquisador@example.com"));
    }

    @Test
    void missingUserIsReportedAsNotFound() throws Exception {
        when(userService.getUser(99L)).thenThrow(new ResourceNotFoundException("Usuário não encontrado: 99"));

        mockMvc.perform(get("/api/users/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateAcceptsDetailsAndRole() throws Exception {
        User user = new User("Coordenador", "coordenador@example.com", "{bcrypt}hash", UserRole.COORDINATOR);
        ReflectionTestUtils.setField(user, "id", 7L);
        when(userService.updateUser(7L, "Coordenador", "coordenador@example.com", UserRole.COORDINATOR))
                .thenReturn(user);

        mockMvc.perform(put("/api/users/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Coordenador","email":"coordenador@example.com","role":"COORDINATOR"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("COORDINATOR"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void deactivateReturnsInactiveUser() throws Exception {
        User user = new User("Pesquisador", "pesquisador@example.com", "{bcrypt}hash", UserRole.RESEARCHER);
        user.deactivate();
        when(userService.deactivateUser(7L)).thenReturn(user);

        mockMvc.perform(patch("/api/users/7/deactivate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void deleteReturnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/users/7"))
                .andExpect(status().isNoContent());
    }
}
