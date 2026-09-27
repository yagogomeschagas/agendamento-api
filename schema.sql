-- ============================================================
-- Schema: Sistema de Agendamento (barbearia / clínica / etc.)
-- Banco: PostgreSQL 14+
-- ============================================================

-- Extensão necessária para o EXCLUDE constraint anti-conflito
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
CREATE TYPE papel_usuario AS ENUM ('admin', 'profissional', 'cliente');
CREATE TYPE status_agendamento AS ENUM ('pendente', 'confirmado', 'cancelado', 'concluido');
CREATE TYPE tipo_notificacao AS ENUM ('confirmacao', 'lembrete', 'cancelamento');

-- ------------------------------------------------------------
-- USUARIOS
-- ------------------------------------------------------------
CREATE TABLE usuarios (
    id            SERIAL PRIMARY KEY,
    nome          VARCHAR(120) NOT NULL,
    email         VARCHAR(160) NOT NULL UNIQUE,
    senha_hash    TEXT NOT NULL,
    papel         papel_usuario NOT NULL DEFAULT 'cliente',
    telefone      VARCHAR(20),
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- NEGOCIOS
-- ------------------------------------------------------------
CREATE TABLE negocios (
    id                    SERIAL PRIMARY KEY,
    dono_id               INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome                  VARCHAR(150) NOT NULL,
    horario_funcionamento JSONB,           -- ex: {"seg": ["09:00","19:00"], ...}
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- PROFISSIONAIS (vincula um usuário a um negócio)
-- ------------------------------------------------------------
CREATE TABLE profissionais (
    id             SERIAL PRIMARY KEY,
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    negocio_id     INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    especialidades VARCHAR(255),
    ativo          BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (usuario_id, negocio_id)
);

-- ------------------------------------------------------------
-- SERVICOS
-- ------------------------------------------------------------
CREATE TABLE servicos (
    id           SERIAL PRIMARY KEY,
    negocio_id   INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nome         VARCHAR(120) NOT NULL,
    duracao_min  INTEGER NOT NULL CHECK (duracao_min > 0),
    preco        NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
    ativo        BOOLEAN NOT NULL DEFAULT true
);

-- ------------------------------------------------------------
-- DISPONIBILIDADE (agenda semanal recorrente do profissional)
-- ------------------------------------------------------------
CREATE TABLE disponibilidades (
    id               SERIAL PRIMARY KEY,
    profissional_id  INTEGER NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    dia_semana       SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo
    hora_inicio      TIME NOT NULL,
    hora_fim         TIME NOT NULL,
    CHECK (hora_fim > hora_inicio)
);

-- ------------------------------------------------------------
-- AGENDAMENTOS
-- ------------------------------------------------------------
CREATE TABLE agendamentos (
    id               SERIAL PRIMARY KEY,
    cliente_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    profissional_id  INTEGER NOT NULL REFERENCES profissionais(id) ON DELETE RESTRICT,
    servico_id       INTEGER NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,
    data_hora        TIMESTAMPTZ NOT NULL,
    duracao_min      INTEGER NOT NULL,   -- copiado do serviço no momento da criação
    status           status_agendamento NOT NULL DEFAULT 'pendente',
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Coluna gerada: intervalo de tempo ocupado por este agendamento
    periodo tsrange GENERATED ALWAYS AS (
        tsrange(data_hora AT TIME ZONE 'UTC',
                (data_hora AT TIME ZONE 'UTC') + (duracao_min || ' minutes')::interval,
                '[)')
    ) STORED,

    -- ANTI-CONFLITO NO NÍVEL DO BANCO:
    -- impede dois agendamentos com status ativo se sobreporem para o mesmo profissional,
    -- mesmo que a validação da aplicação falhe (concorrência, bug, etc.)
    EXCLUDE USING gist (
        profissional_id WITH =,
        periodo WITH &&
    ) WHERE (status IN ('pendente', 'confirmado'))
);

CREATE INDEX idx_agendamentos_profissional_data ON agendamentos (profissional_id, data_hora);
CREATE INDEX idx_agendamentos_cliente ON agendamentos (cliente_id);

-- ------------------------------------------------------------
-- NOTIFICACOES
-- ------------------------------------------------------------
CREATE TABLE notificacoes (
    id              SERIAL PRIMARY KEY,
    agendamento_id  INTEGER NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
    tipo            tipo_notificacao NOT NULL,
    enviado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- REFRESH TOKENS (para o fluxo de autenticação JWT)
-- ------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expira_em   TIMESTAMPTZ NOT NULL,
    revogado    BOOLEAN NOT NULL DEFAULT false,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_usuario ON refresh_tokens (usuario_id);
