CREATE DATABASE IF NOT EXISTS clinica_funeraria;
USE clinica_funeraria;

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('patient', 'doctor', 'admin') NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Pacientes
CREATE TABLE IF NOT EXISTS pacientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    nombre VARCHAR(255) NOT NULL,
    dni VARCHAR(50) NOT NULL UNIQUE,
    telefono VARCHAR(50),
    direccion VARCHAR(255),
    grupo_sanguineo VARCHAR(10),
    alergias TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabla de Médicos
CREATE TABLE IF NOT EXISTS medicos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    nombre VARCHAR(255) NOT NULL,
    especialidad VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'Activo',
    fecha_alta DATE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabla de Citas
CREATE TABLE IF NOT EXISTS citas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT NOT NULL,
    medico_id INT,
    fecha_hora DATETIME NOT NULL,
    motivo VARCHAR(255),
    sintomas TEXT,
    prioridad_alta BOOLEAN DEFAULT FALSE,
    estado ENUM('Pendiente', 'Aceptada', 'Rechazada', 'Completado', 'Cancelado') DEFAULT 'Pendiente',
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES medicos(id) ON DELETE SET NULL
);

-- Tabla de Informes de Pacientes
CREATE TABLE IF NOT EXISTS informe_paciente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT NOT NULL,
    cita_id INT,
    vitals_altura INT,
    vitals_peso INT,
    vitals_respiracion INT,
    vitals_presion VARCHAR(50),
    observaciones TEXT,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE SET NULL
);

-- Insertar usuario administrador por defecto (admin / admin)
INSERT IGNORE INTO usuarios (email, password_hash, rol) 
VALUES ('admin@clinical.com', 'admin', 'admin');
