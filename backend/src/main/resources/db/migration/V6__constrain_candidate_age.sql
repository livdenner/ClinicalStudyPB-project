ALTER TABLE candidates
    DROP CONSTRAINT ck_candidate_age,
    ADD CONSTRAINT ck_candidate_age CHECK (age BETWEEN 1 AND 130);
