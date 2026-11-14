package clinicalstudypb.candidates.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Dados mínimos para vincular o candidato a uma conta de participante. */
public record CandidateCreateRequest(@NotBlank @Size(max = 120) String name,
                                     @NotNull @Min(1) @Max(130) Integer age,
                                     @NotBlank @Email @Size(max = 255) String email,
                                     @NotBlank @Size(min = 8, max = 20)
                                     @Pattern(regexp = "^\\+?[0-9 ()-]{8,20}$") String phone) {
}
