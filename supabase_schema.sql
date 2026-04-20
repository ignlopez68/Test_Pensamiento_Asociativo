-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    "nia" TEXT,
    age INTEGER,
    sex TEXT,
    degree TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de respuestas del test
CREATE TABLE IF NOT EXISTS pa_test_responses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    response_number INTEGER,
    response_text TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de análisis de respuestas
CREATE TABLE IF NOT EXISTS pa_response_analysis (
    response_id INTEGER PRIMARY KEY REFERENCES pa_test_responses(id) ON DELETE CASCADE,
    category TEXT,
    date_analyzed TIMESTAMP WITH TIME ZONE
);

-- Tabla de resultados de los análisis del test
CREATE TABLE IF NOT EXISTS pa_analysis_results (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date TEXT,
    fluidez INTEGER,
    originalidad INTEGER,
    originalidad_relativa REAL,
    flexibilidad INTEGER,
    flexibilidad_relativa REAL,
    elaboracion REAL,
    UNIQUE(user_id, date)
);
