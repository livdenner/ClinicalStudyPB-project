-- Estudos fictícios de demonstração (T16.3): um estudo em cada estado, com o histórico de
-- transições coerente com o estado atual e com visitas previstas e atividades.
--
-- Pré-requisitos: migrações até a V4 e backend/dev/seed_demo_users.sql (o pesquisador de
-- demonstração é o responsável por todos os estudos).
--
-- Repetível: um estudo só é criado se ainda não existir estudo com o mesmo título, então rodar
-- o script de novo não duplica nada. Não é uma migração Flyway e não roda com o backend.
--
-- Para acrescentar um cenário, adicione um objeto à lista `demo`. O script confere se o
-- histórico forma uma sequência que termina no estado informado e se as datas das visitas
-- cabem no período do estudo, e falha sem gravar nada se algo estiver incoerente.

DO $$
DECLARE
    demo CONSTANT JSONB := $json$
    [
      {
        "title": "Adesão ao tratamento da hipertensão arterial",
        "objective": "Avaliar a adesão ao tratamento anti-hipertensivo ao longo de 12 meses.",
        "startDate": "2027-02-01", "endDate": "2027-12-17", "participantLimit": 60,
        "status": "PLANNING",
        "history": [],
        "visits": [
          {"name": "Consulta inicial", "date": "2027-02-15", "activities": [
            ["Entrevista clínica", "Histórico de saúde e medicamentos em uso"],
            ["Aferição da pressão arterial", "Três medidas em repouso, com intervalo de 1 minuto"]]},
          {"name": "Retorno de 3 meses", "date": "2027-05-17", "activities": [
            ["Aferição da pressão arterial", "Três medidas em repouso, com intervalo de 1 minuto"],
            ["Questionário de adesão", "Questionário sobre o uso dos medicamentos no último mês"]]}
        ]
      },
      {
        "title": "Vacina contra influenza em idosos",
        "objective": "Medir a resposta imune à vacina contra influenza em pessoas com 65 anos ou mais.",
        "startDate": "2026-10-01", "endDate": "2027-09-30", "participantLimit": 120,
        "status": "RECRUITMENT",
        "history": [
          {"from": "PLANNING", "to": "RECRUITMENT", "at": "2026-10-20T10:00:00-03:00"}
        ],
        "visits": [
          {"name": "Triagem", "date": "2026-11-16", "activities": [
            ["Entrevista de elegibilidade", "Confirmação da idade e das condições de saúde"],
            ["Sinais vitais", "Pressão arterial, temperatura e frequência cardíaca"]]},
          {"name": "Aplicação da vacina", "date": "2026-11-30", "activities": [
            ["Aplicação da dose", "Dose única intramuscular"],
            ["Observação", "Observação por 30 minutos após a aplicação"]]},
          {"name": "Retorno de 30 dias", "date": "2026-12-30", "activities": [
            ["Coleta de sangue", "Amostra para dosagem de anticorpos"]]}
        ]
      },
      {
        "title": "Controle glicêmico no diabetes tipo 2",
        "objective": "Comparar a hemoglobina glicada antes e depois de um programa de orientação nutricional.",
        "startDate": "2026-08-03", "endDate": "2027-07-30", "participantLimit": 40,
        "status": "EXECUTION",
        "history": [
          {"from": "PLANNING", "to": "RECRUITMENT", "at": "2026-08-20T09:00:00-03:00"},
          {"from": "RECRUITMENT", "to": "EXECUTION", "at": "2026-10-01T09:00:00-03:00"}
        ],
        "visits": [
          {"name": "Avaliação inicial", "date": "2026-10-05", "activities": [
            ["Hemoglobina glicada", "Coleta de sangue em jejum"],
            ["Orientação nutricional", "Entrega do plano alimentar individual"]]},
          {"name": "Acompanhamento de 3 meses", "date": "2027-01-05", "activities": [
            ["Hemoglobina glicada", "Coleta de sangue em jejum"]]},
          {"name": "Acompanhamento de 6 meses", "date": "2027-04-05", "activities": [
            ["Hemoglobina glicada", "Coleta de sangue em jejum"],
            ["Eventos adversos", "Registro de hipoglicemias e outros eventos desde a última visita"]]}
        ]
      },
      {
        "title": "Reabilitação motora após AVC",
        "objective": "Avaliar a recuperação motora com fisioterapia intensiva nos primeiros meses após o AVC.",
        "startDate": "2026-01-12", "endDate": "2026-10-30", "participantLimit": 30,
        "status": "CLOSED",
        "history": [
          {"from": "PLANNING", "to": "RECRUITMENT", "at": "2026-02-02T14:00:00-03:00"},
          {"from": "RECRUITMENT", "to": "EXECUTION", "at": "2026-03-16T14:00:00-03:00"},
          {"from": "EXECUTION", "to": "CLOSED", "at": "2026-10-30T17:00:00-03:00"}
        ],
        "visits": [
          {"name": "Avaliação funcional inicial", "date": "2026-03-23", "activities": [
            ["Escala de Fugl-Meyer", "Avaliação da função motora dos membros"]]},
          {"name": "Reavaliação final", "date": "2026-10-26", "activities": [
            ["Escala de Fugl-Meyer", "Avaliação da função motora dos membros"],
            ["Qualidade de vida", "Questionário de qualidade de vida após o AVC"]]}
        ]
      },
      {
        "title": "Tratamento da asma em crianças",
        "objective": "Avaliar o controle da asma em crianças de 6 a 12 anos com corticoide inalatório.",
        "startDate": "2026-09-14", "endDate": "2027-03-31", "participantLimit": 50,
        "status": "CANCELLED",
        "history": [
          {"from": "PLANNING", "to": "RECRUITMENT", "at": "2026-09-28T11:00:00-03:00"},
          {"from": "RECRUITMENT", "to": "CANCELLED", "at": "2026-10-26T16:30:00-03:00",
           "reason": "O fornecedor suspendeu a entrega do medicamento. O recrutamento fica interrompido até nova data."}
        ],
        "visits": [
          {"name": "Triagem", "date": "2026-10-05", "activities": [
            ["Espirometria", "Prova de função pulmonar"],
            ["Consentimento dos responsáveis", "Leitura e assinatura do termo pelos responsáveis"]]}
        ]
      },
      {
        "title": "Higiene do sono em trabalhadores noturnos",
        "objective": "Avaliar o efeito de orientações de higiene do sono em quem trabalha à noite.",
        "startDate": "2026-10-05", "endDate": "2027-06-30", "participantLimit": 3,
        "status": "RECRUITMENT",
        "history": [
          {"from": "PLANNING", "to": "RECRUITMENT", "at": "2026-10-15T15:00:00-03:00"}
        ],
        "visits": [
          {"name": "Avaliação do sono", "date": "2026-12-07", "activities": [
            ["Diário do sono", "Entrega do diário para registro durante 14 dias"],
            ["Escala de sonolência", "Aplicação da escala de sonolência de Epworth"]]}
        ]
      }
    ]
    $json$;
    researcher BIGINT;
    study JSONB;
    change JSONB;
    visit JSONB;
    activity JSONB;
    new_study_id BIGINT;
    new_visit_id BIGINT;
    current_status TEXT;
    visit_position INTEGER;
    activity_position INTEGER;
    created INTEGER := 0;
BEGIN
    SELECT id INTO researcher
      FROM users
     WHERE email = 'pesquisador@clinicalstudypb.test' AND role = 'RESEARCHER';
    IF researcher IS NULL THEN
        RAISE EXCEPTION 'Pesquisador de demonstração não encontrado. Execute antes backend/dev/seed_demo_users.sql.';
    END IF;

    FOR study IN SELECT value FROM jsonb_array_elements(demo) LOOP
        -- Confere a coerência do cenário antes de gravar qualquer coisa.
        current_status := 'PLANNING';
        FOR change IN SELECT value FROM jsonb_array_elements(study -> 'history') LOOP
            IF change ->> 'from' <> current_status THEN
                RAISE EXCEPTION 'Histórico de "%" não forma uma sequência: esperava sair de %, mas saiu de %.',
                    study ->> 'title', current_status, change ->> 'from';
            END IF;
            current_status := change ->> 'to';
        END LOOP;
        IF current_status <> study ->> 'status' THEN
            RAISE EXCEPTION 'Histórico de "%" termina em %, mas o estado informado é %.',
                study ->> 'title', current_status, study ->> 'status';
        END IF;
        FOR visit IN SELECT value FROM jsonb_array_elements(study -> 'visits') LOOP
            IF (visit ->> 'date')::DATE NOT BETWEEN (study ->> 'startDate')::DATE AND (study ->> 'endDate')::DATE THEN
                RAISE EXCEPTION 'A visita "%" de "%" está fora do período do estudo.',
                    visit ->> 'name', study ->> 'title';
            END IF;
        END LOOP;

        CONTINUE WHEN EXISTS (SELECT 1 FROM studies WHERE title = study ->> 'title');

        INSERT INTO studies (title, objective, responsible_user_id, start_date, end_date,
                             participant_limit, status)
        VALUES (study ->> 'title', study ->> 'objective', researcher,
                (study ->> 'startDate')::DATE, (study ->> 'endDate')::DATE,
                (study ->> 'participantLimit')::INTEGER, study ->> 'status')
        RETURNING id INTO new_study_id;

        -- A ordem de inserção importa: a API restaura um estudo cancelado pela última linha do histórico.
        FOR change IN SELECT value FROM jsonb_array_elements(study -> 'history') WITH ORDINALITY ORDER BY ordinality LOOP
            INSERT INTO study_status_history (study_id, actor_user_id, changed_at, from_status, to_status, reason)
            VALUES (new_study_id, researcher, (change ->> 'at')::TIMESTAMPTZ,
                    change ->> 'from', change ->> 'to', change ->> 'reason');
        END LOOP;

        visit_position := 0;
        FOR visit IN SELECT value FROM jsonb_array_elements(study -> 'visits') WITH ORDINALITY ORDER BY ordinality LOOP
            visit_position := visit_position + 1;
            INSERT INTO planned_visits (study_id, name, planned_date, position)
            VALUES (new_study_id, visit ->> 'name', (visit ->> 'date')::DATE, visit_position)
            RETURNING id INTO new_visit_id;

            activity_position := 0;
            FOR activity IN SELECT value FROM jsonb_array_elements(visit -> 'activities') WITH ORDINALITY ORDER BY ordinality LOOP
                activity_position := activity_position + 1;
                -- name_key segue a mesma normalização da API: sem espaços nas pontas e em minúsculas.
                INSERT INTO planned_activities (planned_visit_id, name, name_key, description, position)
                VALUES (new_visit_id, activity ->> 0, lower(btrim(activity ->> 0)), activity ->> 1, activity_position);
            END LOOP;
        END LOOP;

        created := created + 1;
    END LOOP;

    RAISE NOTICE 'Estudos de demonstração criados: % (já existiam: %).',
        created, jsonb_array_length(demo) - created;
END
$$;
