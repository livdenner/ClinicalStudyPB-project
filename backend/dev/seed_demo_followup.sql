-- Dados fictícios de acompanhamento (T26.6): fluxo do candidato no aplicativo, agendamentos,
-- desfechos, resultados de atividades e uma retirada (RF10 no app, RF12 a RF18).
--
-- Pré-requisitos: migrações até a V15 e, nessa ordem, backend/dev/seed_demo_users.sql,
-- backend/dev/seed_demo_studies.sql e backend/dev/seed_demo_recruitment.sql.
--
-- Contas usadas:
-- - participante@clinicalstudypb.test (senha Demo@Clinical2026, de seed_demo_users.sql): já
--   ativa, participante incluída no estudo de diabetes, com visitas e resultados, e com um
--   convite aguardando decisão no estudo da vacina. Demonstra RF17, RF18 e a decisão no app sem
--   precisar de ativação.
-- - convite@clinicalstudypb.test: conta criada aqui, ainda não ativada. Primeiro acesso no app com
--   o código CONVITE-DEMO-2026, que vale 72 horas a partir da execução do script. Rodar o script de
--   novo renova o prazo enquanto o código não tiver sido usado.
--
-- Repetível: cada candidatura só é criada se a conta ainda não tiver candidatura no estudo, e os
-- agendamentos só são criados se o estudo ainda não tiver nenhum. Rodar de novo não duplica nada
-- nem desfaz o que foi feito pela aplicação. Não é uma migração Flyway e não roda com o backend.
-- O script confere os cenários antes de gravar e falha sem gravar nada se algo estiver incoerente.

DO $$
DECLARE
    known_code CONSTANT TEXT := 'CONVITE-DEMO-2026';
    invite_email CONSTANT TEXT := 'convite@clinicalstudypb.test';
    followup_study CONSTANT TEXT := 'Controle glicêmico no diabetes tipo 2';
    withdrawn_name CONSTANT TEXT := 'Lúcia Mendes Araújo';
    withdrawal_time CONSTANT TIMESTAMPTZ := '2026-11-10T10:00:00-03:00';
    withdrawal_text CONSTANT TEXT := 'Mudou-se para outra cidade e não poderá comparecer às visitas.';
    withdrawal_note CONSTANT TEXT := 'Retirada do participante';
    candidacies CONSTANT JSONB := $json$
    [
      {"study": "Controle glicêmico no diabetes tipo 2", "email": "participante@clinicalstudypb.test",
       "name": "Participante Demo", "age": 67, "phone": "(83) 98888-0001", "answers": [true, false],
       "evaluatedAt": "2026-09-01T10:00:00-03:00", "consent": "GRANTED",
       "consentAt": "2026-09-08T10:00:00-03:00", "includedAt": "2026-09-15T10:00:00-03:00"},
      {"study": "Vacina contra influenza em idosos", "email": "participante@clinicalstudypb.test",
       "name": "Participante Demo", "age": 67, "phone": "(83) 98888-0001", "answers": [true, true, false],
       "evaluatedAt": "2026-11-16T10:00:00-03:00"},
      {"study": "Vacina contra influenza em idosos", "email": "convite@clinicalstudypb.test",
       "name": "Rosa Helena Prates", "age": 70, "phone": "(83) 98888-0002", "answers": [true, true, false],
       "evaluatedAt": "2026-11-16T11:00:00-03:00"}
    ]
    $json$;
    -- Visitas do estudo de diabetes (EXECUTION). `visit` é a posição da visita prevista; em
    -- `results`, cada par [valor, observação] responde à atividade na mesma posição.
    visits CONSTANT JSONB := $json$
    [
      {"who": "Irene Gomes Vieira", "visit": 1, "at": "2026-10-05T09:00:00-03:00",
       "createdAt": "2026-09-22T09:00:00-03:00", "status": "DONE",
       "results": [["7,8%", "Coleta após 10 horas de jejum"], ["Plano alimentar entregue", null]]},
      {"who": "Irene Gomes Vieira", "visit": 2, "at": "2027-01-05T09:00:00-03:00",
       "createdAt": "2026-10-20T09:00:00-03:00", "status": "SCHEDULED"},
      {"who": "João Batista Freitas", "visit": 1, "at": "2026-10-05T10:00:00-03:00",
       "createdAt": "2026-09-22T09:10:00-03:00", "status": "ABSENT",
       "note": "Não compareceu e não respondeu ao contato telefônico."},
      {"who": "João Batista Freitas", "visit": 1, "at": "2026-12-03T09:00:00-03:00",
       "createdAt": "2026-10-06T15:00:00-03:00", "status": "SCHEDULED"},
      {"who": "João Batista Freitas", "visit": 2, "at": "2027-01-05T10:00:00-03:00",
       "createdAt": "2026-10-20T09:10:00-03:00", "status": "CANCELLED",
       "outcomeAt": "2026-11-12T14:00:00-03:00",
       "note": "Participante informou viagem no período; nova data será combinada."},
      {"who": "Lúcia Mendes Araújo", "visit": 1, "at": "2026-10-05T14:00:00-03:00",
       "createdAt": "2026-09-22T09:20:00-03:00", "status": "DONE",
       "results": [["6,9%", null], ["Plano alimentar entregue", "Orientada a registrar as refeições"]]},
      {"who": "Lúcia Mendes Araújo", "visit": 2, "at": "2027-01-05T14:00:00-03:00",
       "createdAt": "2026-10-20T09:20:00-03:00", "status": "SCHEDULED", "withdrawal": true},
      {"who": "Participante Demo", "visit": 1, "at": "2026-10-05T11:00:00-03:00",
       "createdAt": "2026-09-22T09:30:00-03:00", "status": "DONE",
       "results": [["7,2%", null], ["Plano alimentar entregue", null]]},
      {"who": "Participante Demo", "visit": 2, "at": "2027-01-05T11:00:00-03:00",
       "createdAt": "2026-10-20T09:30:00-03:00", "status": "SCHEDULED"}
    ]
    $json$;
    coordinator BIGINT;
    researcher BIGINT;
    target_user BIGINT;
    target_study BIGINT;
    followup_study_id BIGINT;
    entry JSONB;
    result_entry JSONB;
    criterion_ids BIGINT[];
    activity_ids BIGINT[];
    computed_status TEXT;
    new_candidate_id BIGINT;
    target_participant BIGINT;
    target_planned_visit BIGINT;
    new_visit_id BIGINT;
    visit_status TEXT;
    occurred_at TIMESTAMPTZ;
    position_index INTEGER;
    created_candidacies INTEGER := 0;
    created_visits INTEGER := 0;
    cancelled_by_withdrawal INTEGER := 0;
BEGIN
    SELECT id INTO coordinator FROM users
     WHERE email = 'coordenador@clinicalstudypb.test' AND role = 'COORDINATOR';
    SELECT id INTO researcher FROM users
     WHERE email = 'pesquisador@clinicalstudypb.test' AND role = 'RESEARCHER';
    IF coordinator IS NULL OR researcher IS NULL
       OR NOT EXISTS (SELECT 1 FROM users WHERE email = 'participante@clinicalstudypb.test'
                                            AND role = 'PARTICIPANT') THEN
        RAISE EXCEPTION 'Contas de demonstração não encontradas. Execute antes backend/dev/seed_demo_users.sql.';
    END IF;

    SELECT id INTO followup_study_id FROM studies WHERE title = followup_study AND status = 'EXECUTION';
    IF followup_study_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM participants p JOIN candidates c ON c.id = p.candidate_id
                       WHERE p.study_id = followup_study_id AND c.name = withdrawn_name) THEN
        RAISE EXCEPTION 'Participantes do estudo "%" não encontrados. Execute antes backend/dev/seed_demo_studies.sql e backend/dev/seed_demo_recruitment.sql.',
            followup_study;
    END IF;

    -- Conta do convite pendente: candidato que ainda vai fazer o primeiro acesso no aplicativo.
    INSERT INTO users (name, email, password_hash, role, active, activation_pending)
    VALUES ('Rosa Helena Prates', invite_email,
            '{bcrypt}$2a$10$XvTRsPld615GPVfvH3j3fuIKUt4rxnR2D5IRbtCKk/WoUOM6m7ooy',
            'PARTICIPANT', FALSE, TRUE)
    ON CONFLICT (email) DO NOTHING;

    -- Candidaturas das contas que entram no aplicativo.
    FOR entry IN SELECT value FROM jsonb_array_elements(candidacies) WITH ORDINALITY ORDER BY ordinality LOOP
        SELECT id INTO target_study FROM studies WHERE title = entry ->> 'study';
        SELECT id INTO target_user FROM users WHERE email = entry ->> 'email';
        IF target_study IS NULL OR target_user IS NULL THEN
            RAISE EXCEPTION 'Estudo "%" ou conta % não encontrados.', entry ->> 'study', entry ->> 'email';
        END IF;
        CONTINUE WHEN EXISTS (SELECT 1 FROM candidates WHERE study_id = target_study AND user_id = target_user);

        SELECT array_agg(id ORDER BY id) INTO criterion_ids FROM study_criteria WHERE study_id = target_study;
        IF jsonb_array_length(entry -> 'answers') <> COALESCE(array_length(criterion_ids, 1), 0) THEN
            RAISE EXCEPTION 'A candidatura de "%" em "%" precisa responder a todos os critérios.',
                entry ->> 'name', entry ->> 'study';
        END IF;
        computed_status := CASE
            WHEN EXISTS (SELECT 1
                           FROM jsonb_array_elements(entry -> 'answers') WITH ORDINALITY a(answer, idx)
                           JOIN study_criteria k ON k.id = criterion_ids[a.idx::INTEGER]
                          WHERE (a.answer)::BOOLEAN <> (k.type = 'INCLUSION')) THEN 'INELIGIBLE'
            ELSE 'ELIGIBLE'
        END;

        INSERT INTO candidates (study_id, name, name_key, age, email, phone, user_id, eligibility_status)
        VALUES (target_study, entry ->> 'name', lower(entry ->> 'name'), (entry ->> 'age')::INTEGER,
                entry ->> 'email', entry ->> 'phone', target_user, computed_status)
        RETURNING id INTO new_candidate_id;

        FOR position_index IN 1 .. array_length(criterion_ids, 1) LOOP
            INSERT INTO eligibility_answers (candidate_id, criterion_id, matches)
            VALUES (new_candidate_id, criterion_ids[position_index],
                    (entry -> 'answers' -> (position_index - 1))::BOOLEAN);
        END LOOP;
        INSERT INTO eligibility_evaluations (candidate_id, evaluated_by, evaluated_at)
        VALUES (new_candidate_id, coordinator, (entry ->> 'evaluatedAt')::TIMESTAMPTZ);

        IF entry ? 'consent' THEN
            INSERT INTO simulated_consents (
                candidate_id, status, recorded_at, locked_after_inclusion, recorded_by_user_id
            )
            VALUES (new_candidate_id, entry ->> 'consent', (entry ->> 'consentAt')::TIMESTAMPTZ,
                    entry ? 'includedAt', target_user);
        END IF;

        IF entry ? 'includedAt' THEN
            IF computed_status <> 'ELIGIBLE' OR entry ->> 'consent' IS DISTINCT FROM 'GRANTED' THEN
                RAISE EXCEPTION 'A candidatura de "%" não pode ser incluída.', entry ->> 'name';
            END IF;
            INSERT INTO participants (study_id, candidate_id, included_by, included_at)
            VALUES (target_study, new_candidate_id, coordinator, (entry ->> 'includedAt')::TIMESTAMPTZ);
        END IF;
        created_candidacies := created_candidacies + 1;
    END LOOP;

    -- Agendamentos, desfechos, resultados e retirada no estudo em execução.
    IF NOT EXISTS (SELECT 1 FROM scheduled_visits WHERE study_id = followup_study_id) THEN
        FOR entry IN SELECT value FROM jsonb_array_elements(visits) WITH ORDINALITY ORDER BY ordinality LOOP
            SELECT p.id INTO target_participant
              FROM participants p JOIN candidates c ON c.id = p.candidate_id
             WHERE p.study_id = followup_study_id AND c.name = entry ->> 'who';
            SELECT id INTO target_planned_visit
              FROM planned_visits
             WHERE study_id = followup_study_id AND position = (entry ->> 'visit')::INTEGER;
            IF target_participant IS NULL OR target_planned_visit IS NULL THEN
                RAISE EXCEPTION 'Participante "%" ou visita % não encontrados em "%".',
                    entry ->> 'who', entry ->> 'visit', followup_study;
            END IF;

            visit_status := entry ->> 'status';
            occurred_at := CASE
                WHEN visit_status IN ('DONE', 'ABSENT') THEN (entry ->> 'at')::TIMESTAMPTZ + INTERVAL '1 hour'
                ELSE (entry ->> 'outcomeAt')::TIMESTAMPTZ
            END;
            IF (entry ->> 'createdAt')::TIMESTAMPTZ >= (entry ->> 'at')::TIMESTAMPTZ THEN
                RAISE EXCEPTION 'O agendamento de "%" precisa ser criado antes da data da visita.', entry ->> 'who';
            END IF;

            INSERT INTO scheduled_visits (
                study_id, participant_id, planned_visit_id, scheduled_at, status,
                created_by_user_id, created_at, outcome_by_user_id, outcome_at, outcome_note, version
            )
            VALUES (followup_study_id, target_participant, target_planned_visit,
                    (entry ->> 'at')::TIMESTAMPTZ, visit_status, coordinator,
                    (entry ->> 'createdAt')::TIMESTAMPTZ,
                    CASE WHEN visit_status = 'SCHEDULED' THEN NULL ELSE coordinator END,
                    occurred_at, entry ->> 'note',
                    CASE WHEN visit_status = 'SCHEDULED' THEN 0 ELSE 1 END)
            RETURNING id INTO new_visit_id;
            created_visits := created_visits + 1;

            IF entry ? 'results' THEN
                IF visit_status <> 'DONE' THEN
                    RAISE EXCEPTION 'Resultados exigem visita realizada (participante "%").', entry ->> 'who';
                END IF;
                SELECT array_agg(id ORDER BY position) INTO activity_ids
                  FROM planned_activities WHERE planned_visit_id = target_planned_visit;
                IF jsonb_array_length(entry -> 'results') > array_length(activity_ids, 1) THEN
                    RAISE EXCEPTION 'A visita % tem mais resultados do que atividades.', entry ->> 'visit';
                END IF;
                position_index := 0;
                FOR result_entry IN SELECT value FROM jsonb_array_elements(entry -> 'results') WITH ORDINALITY ORDER BY ordinality LOOP
                    position_index := position_index + 1;
                    INSERT INTO activity_results (
                        scheduled_visit_id, planned_activity_id, value, note, recorded_by_user_id, recorded_at
                    )
                    VALUES (new_visit_id, activity_ids[position_index], result_entry ->> 0, result_entry ->> 1,
                            researcher, occurred_at + INTERVAL '1 day');
                END LOOP;
            END IF;
        END LOOP;

        -- Retirada como em POST .../withdrawal: as visitas futuras ainda agendadas são canceladas.
        SELECT p.id INTO target_participant
          FROM participants p JOIN candidates c ON c.id = p.candidate_id
         WHERE p.study_id = followup_study_id AND c.name = withdrawn_name;
        UPDATE scheduled_visits
           SET status = 'CANCELLED', outcome_by_user_id = coordinator, outcome_at = withdrawal_time,
               outcome_note = withdrawal_note, version = version + 1
         WHERE participant_id = target_participant AND status = 'SCHEDULED' AND scheduled_at > withdrawal_time;
        GET DIAGNOSTICS cancelled_by_withdrawal = ROW_COUNT;
        IF cancelled_by_withdrawal <> (SELECT COUNT(*) FROM jsonb_array_elements(visits) v
                                        WHERE v.value ->> 'who' = withdrawn_name
                                          AND COALESCE((v.value ->> 'withdrawal')::BOOLEAN, FALSE)) THEN
            RAISE EXCEPTION 'A retirada de "%" cancelou % visitas, diferente do cenário.',
                withdrawn_name, cancelled_by_withdrawal;
        END IF;
        UPDATE participants
           SET status = 'WITHDRAWN', withdrawal_reason = withdrawal_text, withdrawn_at = withdrawal_time,
               withdrawn_by_user_id = coordinator, withdrawal_cancelled_visit_count = cancelled_by_withdrawal
         WHERE id = target_participant;
    END IF;

    -- Código conhecido para o primeiro acesso, renovado enquanto não for usado.
    SELECT id INTO target_user FROM users WHERE email = invite_email AND activation_pending;
    IF target_user IS NOT NULL THEN
        INSERT INTO candidate_activation_invites (user_id, code_hash, created_at, expires_at)
        VALUES (target_user, encode(sha256(convert_to(known_code, 'UTF8')), 'hex'),
                date_trunc('milliseconds', CURRENT_TIMESTAMP),
                date_trunc('milliseconds', CURRENT_TIMESTAMP) + INTERVAL '72 hours')
        ON CONFLICT (user_id) DO UPDATE
           SET code_hash = EXCLUDED.code_hash, created_at = EXCLUDED.created_at,
               expires_at = EXCLUDED.expires_at
         WHERE candidate_activation_invites.used_at IS NULL;
    END IF;

    RAISE NOTICE 'Acompanhamento de demonstração: % candidaturas e % agendamentos criados.',
        created_candidacies, created_visits;
END
$$;
