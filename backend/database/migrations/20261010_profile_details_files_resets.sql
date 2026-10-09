-- Fase 6: detalle del perfil en base de datos, archivos (CV y foto) y
-- recuperación de contraseña. Idempotente.

BEGIN;

-- Educación, experiencia y habilidades: antes solo vivían en el navegador.
CREATE TABLE IF NOT EXISTS perfil_educacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    perfil_id BIGINT NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    institucion VARCHAR(200) NOT NULL,
    periodo VARCHAR(100) NOT NULL,
    orden SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS perfil_experiencia (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    perfil_id BIGINT NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
    cargo VARCHAR(200) NOT NULL,
    empresa VARCHAR(200) NOT NULL,
    periodo VARCHAR(100) NOT NULL,
    descripcion TEXT,
    orden SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS perfil_habilidades (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    perfil_id BIGINT NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
    categoria VARCHAR(80) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS perfil_habilidades_unica_idx
    ON perfil_habilidades (perfil_id, categoria, LOWER(nombre));
CREATE INDEX IF NOT EXISTS perfil_educacion_perfil_idx ON perfil_educacion (perfil_id);
CREATE INDEX IF NOT EXISTS perfil_experiencia_perfil_idx ON perfil_experiencia (perfil_id);

-- Archivos del perfil. Se guardan en la base porque el disco de Render
-- (plan gratuito) se borra en cada despliegue. Un archivo por tipo y perfil.
CREATE TABLE IF NOT EXISTS archivos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    perfil_id BIGINT NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('CV', 'FOTO')),
    nombre VARCHAR(200) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    tamano INTEGER NOT NULL CHECK (tamano > 0),
    contenido BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT archivos_perfil_tipo_unico UNIQUE (perfil_id, tipo)
);

-- Tokens de recuperación: solo se guarda el hash SHA-256.
CREATE TABLE IF NOT EXISTS password_resets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_resets_usuario_idx ON password_resets (usuario_id);

-- Versión de sesión: cada token JWT lleva la versión vigente al emitirse.
-- Cambiar o restablecer la contraseña la incrementa y cierra las sesiones anteriores.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

COMMIT;
