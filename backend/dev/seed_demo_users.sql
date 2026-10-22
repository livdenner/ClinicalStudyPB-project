INSERT INTO users (name, email, password_hash, role, active)
VALUES
    ('Pesquisador Demo', 'pesquisador@clinicalstudypb.test',
     '{bcrypt}$2b$12$Ak2Pnw/d5Ki3Ebyo/TORYuch09SON34Ph1iVoOtTl/41Nlk619nGO',
     'RESEARCHER', TRUE),
    ('Coordenador Demo', 'coordenador@clinicalstudypb.test',
     '{bcrypt}$2b$12$L0bvpGiU6NkiSNWWDFRtg.eoaIEH/eb23obtZlDXR88gEy8/pdYfO',
     'COORDINATOR', TRUE),
    ('Administrador Demo', 'administrador@clinicalstudypb.test',
     '{bcrypt}$2b$12$FKJ/OdqTqwo67mQDZZ4w0eIeHxStpBpdSD8iQE2o3oonUE8cfZWku',
     'ADMINISTRATOR', TRUE),
    ('Participante Demo', 'participante@clinicalstudypb.test',
     '{bcrypt}$2b$12$jSnGPYvh0vkCUSWuFw38lu1kVC3aJcpNfAlG1M.PKDVVvNa9qAkHG',
     'PARTICIPANT', TRUE)
ON CONFLICT (email) DO NOTHING;