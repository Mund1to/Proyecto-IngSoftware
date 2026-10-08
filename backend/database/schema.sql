-- Esquema inicial de SIPU
-- PostgreSQL 15+
-- Ejecutar sobre una base de datos vacía de SIPU.

BEGIN;

CREATE TYPE profile_type AS ENUM (
    'ESTUDIANTE',
    'CANDIDATO_EXTERNO',
    'ORGANIZACION'
);

CREATE TYPE offer_type AS ENUM (
    'PRACTICA',
    'EMPLEO',
    'EMPLEO_PUBLICO'
);

CREATE TYPE offer_status AS ENUM (
    'BORRADOR',
    'PUBLICADA',
    'CERRADA',
    'CANCELADA'
);

CREATE TYPE application_status AS ENUM (
    'ENVIADA',
    'EN_REVISION',
    'PRESELECCIONADA',
    'RECHAZADA',
    'RETIRADA',
    'ACEPTADA'
);

CREATE TYPE verification_status AS ENUM (
    'PENDIENTE',
    'APROBADA',
    'RECHAZADA'
);

CREATE TABLE usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,
    nombre_completo VARCHAR(160) NOT NULL,
    telefono VARCHAR(30),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX usuarios_email_unico_idx ON usuarios (LOWER(email));

CREATE TABLE roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE usuario_roles (
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, rol_id)
);

CREATE TABLE perfiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo profile_type NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT perfiles_usuario_tipo_unico UNIQUE (usuario_id, tipo)
);

CREATE TABLE perfiles_estudiante (
    perfil_id BIGINT PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
    universidad VARCHAR(180),
    programa_academico VARCHAR(180),
    semestre SMALLINT,
    codigo_estudiante VARCHAR(80),
    fecha_graduacion_estimada DATE,
    CONSTRAINT estudiante_semestre_valido CHECK (semestre IS NULL OR semestre > 0)
);

CREATE TABLE perfiles_candidato (
    perfil_id BIGINT PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
    resumen TEXT,
    ubicacion VARCHAR(180),
    disponibilidad VARCHAR(120),
    cv_url TEXT
);

CREATE TABLE organizaciones (
    perfil_id BIGINT PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
    razon_social VARCHAR(200) NOT NULL,
    identificacion_fiscal VARCHAR(80),
    sitio_web TEXT,
    descripcion TEXT,
    verificada BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT organizaciones_identificacion_unica UNIQUE (identificacion_fiscal)
);

CREATE TABLE convocatorias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT convocatoria_fechas_validas CHECK (
        fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio
    )
);

CREATE TABLE ofertas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacion_id BIGINT NOT NULL REFERENCES organizaciones(perfil_id) ON DELETE RESTRICT,
    convocatoria_id BIGINT REFERENCES convocatorias(id) ON DELETE SET NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    tipo offer_type NOT NULL,
    estado offer_status NOT NULL DEFAULT 'BORRADOR',
    ubicacion VARCHAR(180),
    modalidad VARCHAR(80),
    remuneracion NUMERIC(12,2),
    remuneracion_maxima NUMERIC(12,2),
    fecha_publicacion TIMESTAMPTZ,
    fecha_cierre TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT oferta_fechas_validas CHECK (
        fecha_cierre IS NULL OR fecha_publicacion IS NULL OR fecha_cierre >= fecha_publicacion
    )
);

CREATE TABLE postulaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    oferta_id BIGINT NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
    candidato_id BIGINT NOT NULL REFERENCES perfiles(id) ON DELETE RESTRICT,
    estado application_status NOT NULL DEFAULT 'ENVIADA',
    carta_presentacion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT postulacion_oferta_candidato_unica UNIQUE (oferta_id, candidato_id)
);

CREATE TABLE verificaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizacion_id BIGINT NOT NULL REFERENCES organizaciones(perfil_id) ON DELETE CASCADE,
    revisado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    estado verification_status NOT NULL DEFAULT 'PENDIENTE',
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX perfiles_usuario_id_idx ON perfiles(usuario_id);
CREATE INDEX ofertas_tipo_estado_idx ON ofertas(tipo, estado);
CREATE INDEX ofertas_organizacion_id_idx ON ofertas(organizacion_id);
CREATE INDEX postulaciones_candidato_id_idx ON postulaciones(candidato_id);
CREATE INDEX postulaciones_oferta_id_idx ON postulaciones(oferta_id);
CREATE INDEX verificaciones_organizacion_id_idx ON verificaciones(organizacion_id);

INSERT INTO roles (nombre, descripcion) VALUES
    ('USUARIO', 'Permisos básicos de una cuenta'),
    ('ADMINISTRADOR', 'Administración y moderación del sistema'),
    ('FUNCIONARIO_PUBLICO', 'Gestión de convocatorias y estadísticas públicas')
ON CONFLICT (nombre) DO NOTHING;

COMMIT;
