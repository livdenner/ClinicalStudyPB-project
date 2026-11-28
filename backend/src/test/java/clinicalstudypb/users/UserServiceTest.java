package clinicalstudypb.users;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.EmailAlreadyInUseException;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserConflictException;
import clinicalstudypb.users.domain.UserRole;
import clinicalstudypb.users.infrastructure.PasswordEncodingConfig;
import clinicalstudypb.users.infrastructure.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Verifica as regras de usuário com repositório simulado e codificação real de senha.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.2
 */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private CurrentActor currentActor;

    private PasswordEncoder passwordEncoder;
    private UserService userService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new PasswordEncodingConfig().passwordEncoder();
        userService = new UserService(userRepository, passwordEncoder, currentActor);
    }

    @Test
    void createUserNormalizesEmailAndStoresDelegatingBcryptHash() {
        String password = "Demo@Clinical2026";
        userService.createUser("  Pesquisador  ", "  PESQUISADOR@EXAMPLE.COM  ", password, UserRole.RESEARCHER);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();
        String passwordHash = (String) ReflectionTestUtils.getField(saved, "passwordHash");

        assertEquals("Pesquisador", saved.getName());
        assertEquals("pesquisador@example.com", saved.getEmail());
        assertTrue(passwordHash.startsWith("{bcrypt}"));
        assertTrue(passwordEncoder.matches(password, passwordHash));
    }

    @Test
    void delegatingEncoderAcceptsExistingDemoUserHash() {
        String seededHash = "{bcrypt}$2b$12$Ak2Pnw/d5Ki3Ebyo/TORYuch09SON34Ph1iVoOtTl/41Nlk619nGO";

        assertTrue(passwordEncoder.matches("Demo@Clinical2026", seededHash));
    }

    @Test
    void createUserRejectsEmailAlreadyInUseIgnoringCase() {
        when(userRepository.existsByEmailIgnoreCase("pesquisador@example.com")).thenReturn(true);

        assertThrows(EmailAlreadyInUseException.class,
                () -> userService.createUser("Outro", "Pesquisador@Example.com", "senha", UserRole.RESEARCHER));

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateUserPreservesDataWhenNewEmailIsAlreadyInUse() {
        User user = new User("Nome original", "original@example.com", "{bcrypt}hash", UserRole.RESEARCHER);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.existsByEmailIgnoreCase("outro@example.com")).thenReturn(true);

        assertThrows(EmailAlreadyInUseException.class,
                () -> userService.updateUser(1L, "Novo nome", "Outro@Example.com", UserRole.COORDINATOR));

        assertEquals("Nome original", user.getName());
        assertEquals("original@example.com", user.getEmail());
        assertEquals(UserRole.RESEARCHER, user.getRole());
    }

    @Test
    void updateUserAllowsSameEmailAndChangesDetailsAndRole() {
        User user = new User("Nome original", "original@example.com", "{bcrypt}hash", UserRole.RESEARCHER);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        User updated = userService.updateUser(1L, "  Novo nome  ", "  ORIGINAL@EXAMPLE.COM  ", UserRole.COORDINATOR);

        assertSame(user, updated);
        assertEquals("Novo nome", updated.getName());
        assertEquals("original@example.com", updated.getEmail());
        assertEquals(UserRole.COORDINATOR, updated.getRole());
        verify(userRepository, never()).existsByEmailIgnoreCase(any());
    }

    @Test
    void deactivateAndReactivateUserWithoutDeletingIt() {
        User user = new User("Pesquisador", "pesquisador@example.com", "{bcrypt}hash", UserRole.RESEARCHER);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertFalse(userService.deactivateUser(1L).isActive());
        assertTrue(userService.activateUser(1L).isActive());
        verify(userRepository, never()).delete(any(User.class));
    }

    @Test
    void getUserRejectsUnknownId() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> userService.getUser(99L));
    }

    @Test
    void deleteUserRemovesExistingRecord() {
        User user = new User("Pesquisador", "pesquisador@example.com", "{bcrypt}hash", UserRole.RESEARCHER);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        userService.deleteUser(1L);

        verify(userRepository).delete(user);
    }

    @Test
    void deleteUserDoesNotRemoveUnknownRecord() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> userService.deleteUser(99L));
        verify(userRepository, never()).delete(any(User.class));
    }

    @Test
    void updateUserAllowsAdministratorToEditOwnNameAndEmailKeepingRole() {
        User admin = userWithId(1L, "Admin", "admin@example.com", UserRole.ADMINISTRATOR);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

        User updated = userService.updateUser(1L, "Admin Atualizada", "nova@example.com", UserRole.ADMINISTRATOR);

        assertSame(admin, updated);
        assertEquals("Admin Atualizada", updated.getName());
        assertEquals("nova@example.com", updated.getEmail());
        assertEquals(UserRole.ADMINISTRATOR, updated.getRole());
        verify(userRepository, never()).lockActiveByRoleOrderByIdAsc(any());
    }

    @Test
    void updateUserRejectsChangingOwnRole() {
        User admin = userWithId(1L, "Admin", "admin@example.com", UserRole.ADMINISTRATOR);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(currentActor.userId()).thenReturn(1L);

        UserConflictException exception = assertThrows(UserConflictException.class,
                () -> userService.updateUser(1L, "Novo Nome", "novo@example.com", UserRole.RESEARCHER));

        assertEquals(UserConflictException.SELF_ACCOUNT_CHANGE_NOT_ALLOWED, exception.getCode());
        assertEquals("Admin", admin.getName());
        assertEquals("admin@example.com", admin.getEmail());
        assertEquals(UserRole.ADMINISTRATOR, admin.getRole());
        verify(userRepository, never()).lockActiveByRoleOrderByIdAsc(any());
    }

    @Test
    void deactivateAndDeleteRejectOwnAccount() {
        User admin = userWithId(1L, "Admin", "admin@example.com", UserRole.ADMINISTRATOR);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(currentActor.userId()).thenReturn(1L);

        UserConflictException deactivateError = assertThrows(UserConflictException.class,
                () -> userService.deactivateUser(1L));
        UserConflictException deleteError = assertThrows(UserConflictException.class,
                () -> userService.deleteUser(1L));

        assertEquals(UserConflictException.SELF_ACCOUNT_CHANGE_NOT_ALLOWED, deactivateError.getCode());
        assertEquals(UserConflictException.SELF_ACCOUNT_CHANGE_NOT_ALLOWED, deleteError.getCode());
        assertTrue(admin.isActive());
        verify(userRepository, never()).delete(any(User.class));
    }

    @Test
    void operationsRejectRemovingLastActiveAdministrator() {
        User targetAdmin = userWithId(2L, "Último Admin", "ultimo@example.com", UserRole.ADMINISTRATOR);
        when(userRepository.findById(2L)).thenReturn(Optional.of(targetAdmin));
        when(currentActor.userId()).thenReturn(1L);
        when(userRepository.lockActiveByRoleOrderByIdAsc(UserRole.ADMINISTRATOR)).thenReturn(List.of(targetAdmin));

        UserConflictException updateError = assertThrows(UserConflictException.class,
                () -> userService.updateUser(2L, "Pesquisador", "ultimo@example.com", UserRole.RESEARCHER));
        UserConflictException deactivateError = assertThrows(UserConflictException.class,
                () -> userService.deactivateUser(2L));
        UserConflictException deleteError = assertThrows(UserConflictException.class,
                () -> userService.deleteUser(2L));

        assertEquals(UserConflictException.LAST_ACTIVE_ADMINISTRATOR, updateError.getCode());
        assertEquals(UserConflictException.LAST_ACTIVE_ADMINISTRATOR, deactivateError.getCode());
        assertEquals(UserConflictException.LAST_ACTIVE_ADMINISTRATOR, deleteError.getCode());
        assertTrue(targetAdmin.isActive());
        assertEquals(UserRole.ADMINISTRATOR, targetAdmin.getRole());
        verify(userRepository, never()).delete(any(User.class));
    }

    @Test
    void operationsAllowRemovingAdminStatusWhenAnotherActiveAdministratorRemains() {
        User otherAdmin = userWithId(1L, "Outro Admin", "outro@example.com", UserRole.ADMINISTRATOR);
        User targetForRoleChange = userWithId(2L, "Admin Dois", "dois@example.com", UserRole.ADMINISTRATOR);
        User targetForDeactivate = userWithId(3L, "Admin Três", "tres@example.com", UserRole.ADMINISTRATOR);
        User targetForDelete = userWithId(4L, "Admin Quatro", "quatro@example.com", UserRole.ADMINISTRATOR);

        when(currentActor.userId()).thenReturn(1L);
        when(userRepository.findById(2L)).thenReturn(Optional.of(targetForRoleChange));
        when(userRepository.findById(3L)).thenReturn(Optional.of(targetForDeactivate));
        when(userRepository.findById(4L)).thenReturn(Optional.of(targetForDelete));
        when(userRepository.lockActiveByRoleOrderByIdAsc(UserRole.ADMINISTRATOR))
                .thenReturn(List.of(otherAdmin, targetForRoleChange))
                .thenReturn(List.of(otherAdmin, targetForDeactivate))
                .thenReturn(List.of(otherAdmin, targetForDelete));

        User updated = userService.updateUser(2L, "Coordenador", "dois@example.com", UserRole.COORDINATOR);
        User deactivated = userService.deactivateUser(3L);
        userService.deleteUser(4L);

        assertEquals(UserRole.COORDINATOR, updated.getRole());
        assertFalse(deactivated.isActive());
        verify(userRepository).delete(targetForDelete);
    }

    @Test
    void suspendPendingActivationRevertsActiveFlagOnlyForPendingParticipants() {
        User invited = User.invitedParticipant("Candidata", "candidata@example.com", "{bcrypt}hash");
        invited.beginActivation();
        assertTrue(invited.isActive());
        assertTrue(invited.isActivationPending());

        invited.suspendPendingActivation();
        assertFalse(invited.isActive());
        assertTrue(invited.isActivationPending());

        User activeParticipant = new User("Participante", "participante@example.com",
                "{bcrypt}hash", UserRole.PARTICIPANT);
        User staff = new User("Pesquisador", "staff@example.com", "{bcrypt}hash", UserRole.RESEARCHER);
        assertThrows(IllegalStateException.class, activeParticipant::suspendPendingActivation);
        assertThrows(IllegalStateException.class, staff::suspendPendingActivation);
    }

    private User userWithId(Long id, String name, String email, UserRole role) {
        User user = new User(name, email, "{bcrypt}hash", role);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }
}
