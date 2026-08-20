-- Odontograma: dentición del paciente + estados por pieza
-- También se aplica automáticamente al iniciar el servidor (lib/ensure-odontograma.js)

-- Si la columna ya existe, ignore el error de duplicado:
ALTER TABLE pacientes
  ADD COLUMN TIPO_PACIENTE VARCHAR(10) NULL DEFAULT 'ADULTO';

CREATE TABLE IF NOT EXISTS odontograma (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  EMPNIT VARCHAR(50) NOT NULL,
  CODPACIENTE INT NOT NULL,
  PIEZA VARCHAR(10) NOT NULL,
  ESTADO VARCHAR(30) NOT NULL DEFAULT 'SANO',
  NOTA VARCHAR(500) NULL,
  FECHA_ACT DATETIME NULL,
  UNIQUE KEY uk_odontograma_pieza (EMPNIT, CODPACIENTE, PIEZA),
  INDEX idx_odontograma_paciente (EMPNIT, CODPACIENTE)
);
