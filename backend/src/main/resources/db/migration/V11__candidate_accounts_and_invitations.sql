-- Registros da Release 1 não tinham contato nem conta. A migração cria
-- identidades fictícias e inativas, reconhecíveis pelo domínio .invalid.
ALTER TABLE candidates ADD COLUMN email VARCHAR(255);
ALTER TABLE candidates ADD COLUMN phone VARCHAR(20);
ALTER TABLE candidates ADD COLUMN user_id BIGINT REFERENCES users (id);
ALTER TABLE users ADD COLUMN activation_pending BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO users (name, email, password_hash, role, active, activation_pending)
SELECT name, 'legacy-candidate-' || id || '@clinicalstudypb.invalid',
       '{bcrypt}$2a$10$XvTRsPld615GPVfvH3j3fuIKUt4rxnR2D5IRbtCKk/WoUOM6m7ooy',
       'PARTICIPANT', FALSE, TRUE
FROM candidates;

UPDATE candidates AS c
SET email = u.email, phone = '00000000', user_id = u.id
FROM users AS u
WHERE u.email = 'legacy-candidate-' || c.id || '@clinicalstudypb.invalid';

ALTER TABLE candidates ALTER COLUMN email SET NOT NULL;
ALTER TABLE candidates ALTER COLUMN phone SET NOT NULL;
ALTER TABLE candidates ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE candidates DROP CONSTRAINT uq_candidate_study_name_age;
ALTER TABLE candidates ADD CONSTRAINT uq_candidate_study_user UNIQUE (study_id, user_id);

-- A mesma identidade não pode ser criada com letras maiúsculas diferentes.
CREATE UNIQUE INDEX ux_users_email_lower ON users (LOWER(email));

CREATE TABLE candidate_activation_invites (
    user_id BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    CONSTRAINT ck_candidate_invite_expiration CHECK (expires_at > created_at)
);

-- O código inicial dos dados legados nunca foi entregue. Deixar o convite
-- vencido permite ao coordenador emitir um novo sem recadastrar o candidato.
INSERT INTO candidate_activation_invites (user_id, code_hash, created_at, expires_at)
SELECT user_id, MD5(gen_random_uuid()::text) || MD5(gen_random_uuid()::text),
       CURRENT_TIMESTAMP - INTERVAL '73 hours', CURRENT_TIMESTAMP - INTERVAL '1 hour'
FROM candidates;
