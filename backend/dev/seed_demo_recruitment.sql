-- Dados fictícios de recrutamento para os estudos de demonstração (T16.3): critérios, candidatos,
-- respostas de elegibilidade, consentimento simulado e participantes.
--
-- Pré-requisitos: migrações até a V10, backend/dev/seed_demo_users.sql e
-- backend/dev/seed_demo_studies.sql, nessa ordem.
--
-- Repetível: um estudo só recebe dados se ainda não tiver critérios nem candidatos, então rodar o
-- script de novo não duplica nada nem desfaz o que foi feito pela aplicação. Não é uma migração
-- Flyway e não roda com o backend.
--
-- Em `answers`, cada valor responde ao critério na mesma posição de `criteria`. A situação do
-- candidato é calculada como na API: faltando resposta, fica PENDING; é ELIGIBLE se atende a todo
-- critério de inclusão e a nenhum de exclusão; caso contrário, INELIGIBLE. O script falha sem
-- gravar nada se um participante não puder ser incluído ou se o limite de vagas for ultrapassado.

DO $$
DECLARE
    demo CONSTANT JSONB := $json$
    [
      {
        "title": "Adesão ao tratamento da hipertensão arterial",
        "criteria": [
          ["INCLUSION", "Ter diagnóstico de hipertensão arterial"],
          ["INCLUSION", "Usar medicamento anti-hipertensivo há pelo menos 3 meses"],
          ["EXCLUSION", "Estar em gestação"]
        ],
        "candidates": []
      },
      {
        "title": "Vacina contra influenza em idosos",
        "evaluatedAt": "2026-10-27T10:00:00-03:00",
        "consentAt": "2026-10-29T10:00:00-03:00",
        "includedAt": "2026-11-03T10:00:00-03:00",
        "criteria": [
          ["INCLUSION", "Ter 65 anos ou mais"],
          ["INCLUSION", "Não ter recebido vacina contra influenza nos últimos 6 meses"],
          ["EXCLUSION", "Ter alergia grave a componentes da vacina"]
        ],
        "candidates": [
          {"name": "Antônia Ferreira Lima", "age": 71, "answers": [true, true, false], "consent": "GRANTED", "included": true},
          {"name": "Benedito Souza Rocha", "age": 68, "answers": [true, true, false], "consent": "GRANTED", "included": true},
          {"name": "Conceição Alves Prado", "age": 74, "answers": [true, true, false], "consent": "GRANTED"},
          {"name": "Domingos Pereira Dias", "age": 66, "answers": [true, true, false]},
          {"name": "Elza Martins Teixeira", "age": 79, "answers": [true, true, false], "consent": "DECLINED"},
          {"name": "Francisco Nunes Barros", "age": 69, "answers": [true, true, true]},
          {"name": "Geralda Moreira Campos", "age": 83, "answers": [true]},
          {"name": "Hélio Cardoso Ramos", "age": 72}
        ]
      },
      {
        "title": "Controle glicêmico no diabetes tipo 2",
        "evaluatedAt": "2026-09-01T09:00:00-03:00",
        "consentAt": "2026-09-08T09:00:00-03:00",
        "includedAt": "2026-09-15T09:00:00-03:00",
        "criteria": [
          ["INCLUSION", "Ter diagnóstico de diabetes tipo 2"],
          ["EXCLUSION", "Usar insulina em dose plena"]
        ],
        "candidates": [
          {"name": "Irene Gomes Vieira", "age": 54, "answers": [true, false], "consent": "GRANTED", "included": true},
          {"name": "João Batista Freitas", "age": 61, "answers": [true, false], "consent": "GRANTED", "included": true},
          {"name": "Lúcia Mendes Araújo", "age": 47, "answers": [true, false], "consent": "GRANTED", "included": true},
          {"name": "Manoel Ribeiro Costa", "age": 66, "answers": [true, true]}
        ]
      },
      {
        "title": "Reabilitação motora após AVC",
        "evaluatedAt": "2026-02-10T14:00:00-03:00",
        "consentAt": "2026-02-17T14:00:00-03:00",
        "includedAt": "2026-03-02T14:00:00-03:00",
        "criteria": [
          ["INCLUSION", "Ter sofrido AVC nos últimos 6 meses"],
          ["EXCLUSION", "Ter contraindicação à fisioterapia intensiva"]
        ],
        "candidates": [
          {"name": "Neusa Carvalho Pinto", "age": 63, "answers": [true, false], "consent": "GRANTED", "included": true},
          {"name": "Osvaldo Tavares Melo", "age": 70, "answers": [true, false], "consent": "GRANTED", "included": true},
          {"name": "Paulina Correia Reis", "age": 58, "answers": [true, false], "consent": "GRANTED", "included": true}
        ]
      },
      {
        "title": "Tratamento da asma em crianças",
        "evaluatedAt": "2026-10-13T11:00:00-03:00",
        "criteria": [
          ["INCLUSION", "Ter entre 6 e 12 anos com diagnóstico de asma"],
          ["EXCLUSION", "Ter sido internado por crise de asma no último mês"]
        ],
        "candidates": [
          {"name": "Rafael Monteiro Lopes", "age": 9, "answers": [true, false]},
          {"name": "Sofia Duarte Farias", "age": 7}
        ]
      },
      {
        "title": "Higiene do sono em trabalhadores noturnos",
        "evaluatedAt": "2026-10-22T15:00:00-03:00",
        "consentAt": "2026-10-26T15:00:00-03:00",
        "includedAt": "2026-11-04T15:00:00-03:00",
        "criteria": [
          ["INCLUSION", "Trabalhar em turno noturno há pelo menos 1 ano"],
          ["EXCLUSION", "Usar medicamento para dormir"]
        ],
        "candidates": [
          {"name": "Tereza Azevedo Cunha", "age": 38, "answers": [true, false], "consent": "GRANTED", "included": true},
          {"name": "Ubirajara Santos Melo", "age": 45, "answers": [true, false], "consent": "GRANTED", "included": true},
          {"name": "Vera Lúcia Fonseca", "age": 41, "answers": [true, false], "consent": "GRANTED"},
          {"name": "Wilson Barbosa Leite", "age": 33, "answers": [true, false], "consent": "GRANTED"}
        ]
      }
    ]
    $json$;
    coordinator BIGINT;
    study JSONB;
    criterion JSONB;
    candidate JSONB;
    answer_list JSONB;
    target_study_id BIGINT;
    vacancies INTEGER;
    criteria_total INTEGER;
    included_total INTEGER;
    new_criterion_id BIGINT;
    new_candidate_id BIGINT;
    criterion_ids BIGINT[];
    computed_status TEXT;
    position_index INTEGER;
    filled INTEGER := 0;
BEGIN
    SELECT id INTO coordinator
      FROM users
     WHERE email = 'coordenador@clinicalstudypb.test' AND role = 'COORDINATOR';
    IF coordinator IS NULL THEN
        RAISE EXCEPTION 'Coordenador de demonstração não encontrado. Execute antes backend/dev/seed_demo_users.sql.';
    END IF;

    FOR study IN SELECT value FROM jsonb_array_elements(demo) LOOP
        SELECT id, participant_limit INTO target_study_id, vacancies
          FROM studies
         WHERE title = study ->> 'title';
        IF target_study_id IS NULL THEN
            RAISE EXCEPTION 'Estudo "%" não encontrado. Execute antes backend/dev/seed_demo_studies.sql.',
                study ->> 'title';
        END IF;

        CONTINUE WHEN EXISTS (SELECT 1 FROM study_criteria WHERE study_id = target_study_id)
                   OR EXISTS (SELECT 1 FROM candidates WHERE study_id = target_study_id);

        criterion_ids := ARRAY[]::BIGINT[];
        FOR criterion IN SELECT value FROM jsonb_array_elements(study -> 'criteria') WITH ORDINALITY ORDER BY ordinality LOOP
            INSERT INTO study_criteria (study_id, type, description)
            VALUES (target_study_id, criterion ->> 0, criterion ->> 1)
            RETURNING id INTO new_criterion_id;
            criterion_ids := array_append(criterion_ids, new_criterion_id);
        END LOOP;
        criteria_total := array_length(criterion_ids, 1);

        included_total := 0;
        FOR candidate IN SELECT value FROM jsonb_array_elements(study -> 'candidates') WITH ORDINALITY ORDER BY ordinality LOOP
            answer_list := COALESCE(candidate -> 'answers', '[]'::JSONB);
            IF jsonb_array_length(answer_list) > criteria_total THEN
                RAISE EXCEPTION 'O candidato "%" tem mais respostas do que critérios.', candidate ->> 'name';
            END IF;

            computed_status := CASE
                WHEN jsonb_array_length(answer_list) < criteria_total THEN 'PENDING'
                WHEN EXISTS (SELECT 1
                               FROM jsonb_array_elements(answer_list) WITH ORDINALITY a(answer, idx)
                               JOIN jsonb_array_elements(study -> 'criteria') WITH ORDINALITY c(item, idx) USING (idx)
                              WHERE (a.answer)::BOOLEAN <> (c.item ->> 0 = 'INCLUSION')) THEN 'INELIGIBLE'
                ELSE 'ELIGIBLE'
            END;

            -- name_key segue a mesma normalização da API, que usa esse valor para detectar duplicidade.
            INSERT INTO candidates (study_id, name, name_key, age, eligibility_status)
            VALUES (target_study_id, candidate ->> 'name', lower(candidate ->> 'name'),
                    (candidate ->> 'age')::INTEGER, computed_status)
            RETURNING id INTO new_candidate_id;

            IF jsonb_array_length(answer_list) > 0 THEN
                FOR position_index IN 1 .. jsonb_array_length(answer_list) LOOP
                    INSERT INTO eligibility_answers (candidate_id, criterion_id, matches)
                    VALUES (new_candidate_id, criterion_ids[position_index],
                            (answer_list -> (position_index - 1))::BOOLEAN);
                END LOOP;
                INSERT INTO eligibility_evaluations (candidate_id, evaluated_by, evaluated_at)
                VALUES (new_candidate_id, coordinator, (study ->> 'evaluatedAt')::TIMESTAMPTZ);
            END IF;

            IF candidate ? 'consent' THEN
                INSERT INTO simulated_consents (candidate_id, status, recorded_at, locked_after_inclusion)
                VALUES (new_candidate_id, candidate ->> 'consent', (study ->> 'consentAt')::TIMESTAMPTZ,
                        COALESCE((candidate ->> 'included')::BOOLEAN, FALSE));
            END IF;

            IF COALESCE((candidate ->> 'included')::BOOLEAN, FALSE) THEN
                IF computed_status <> 'ELIGIBLE' OR candidate ->> 'consent' IS DISTINCT FROM 'GRANTED' THEN
                    RAISE EXCEPTION 'O candidato "%" não pode ser participante: é %, com consentimento %.',
                        candidate ->> 'name', computed_status, COALESCE(candidate ->> 'consent', 'pendente');
                END IF;
                included_total := included_total + 1;
                IF included_total > vacancies THEN
                    RAISE EXCEPTION 'O estudo "%" ultrapassa o limite de % participantes.',
                        study ->> 'title', vacancies;
                END IF;
                INSERT INTO participants (study_id, candidate_id, included_by, included_at)
                VALUES (target_study_id, new_candidate_id, coordinator, (study ->> 'includedAt')::TIMESTAMPTZ);
            END IF;
        END LOOP;

        filled := filled + 1;
    END LOOP;

    RAISE NOTICE 'Estudos que receberam dados de recrutamento: % (já tinham dados: %).',
        filled, jsonb_array_length(demo) - filled;
END
$$;
