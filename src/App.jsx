import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

const studiesOptions = [
  "Grado en Estudios en Arquitectura",
  "Grado en Ingeniería de Tecnologías Industriales",
  "Grado en Ingeniería de Tecnologías y Servicios de Telecomunicación",
  "Grado en Ingeniería Eléctrica",
  "Grado en Ingeniería Electrónica y Automática",
  "Grado en Ingeniería en Diseño Industrial y Desarrollo de Producto",
  "Grado en Ingeniería Informática",
  "Grado en Ingeniería Mecánica",
  "Grado en Ingeniería Química",
  "Doble Grado Consecutivo de Química e Ingeniería Química",
  "Doble Grado Matemáticas Ingeniería Informática",
  "Máster Universitario en Arquitectura",
  "Máster Universitario en Energías Renovables y Eficiencia Energética",
  "Máster Universitario en Ingeniería Biomédica",
  "Máster Universitario en Ingeniería de Diseño de Producto",
  "Máster Universitario en Ingeniería de Telecomunicación",
  "Máster Universitario en Ingeniería Electrónica",
  "Máster Universitario en Ingeniería Industrial",
  "Máster Universitario en Ingeniería Informática",
  "Máster Universitario en Ingeniería Mecánica",
  "Máster Universitario en Ingeniería Química",
  "Máster Universitario en Robótica, Gráficos y Visión por Computador",
  "Título propio",
  "Otro"
];

function InstructionsMode({ onStart }) {
  return (
    <div className="card test-card instructions-card">
      <h1 className="title">Test de Pensamiento Asociativo</h1>
      <div className="instructions-text" style={{ textAlign: 'left', lineHeight: '1.6', marginBottom: '20px', color: '#e5e7eb' }}>
        <p style={{ marginBottom: '15px' }}>En el test de pensamiento asociativo se presenta una imagen y debes responder con asociaciones que describan la relación entre los objetos que se presentan. Cuanto más inusuales y variadas sean las asociaciones, mayor es el índice de creatividad del individuo.</p>
        <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
          <li style={{ marginBottom: '5px' }}>Intenta pensar en cosas que nadie más piense.</li>
          <li style={{ marginBottom: '5px' }}>Intenta pensar en tantas asociaciones como te sea posible.</li>
          <li style={{ marginBottom: '5px' }}>Intenta expresar tu idea en pocas palabras o en una frase breve.</li>
          <li style={{ marginBottom: '5px' }}>Sé conciso en la descripción, pero que tenga sentido completo.</li>
          <li style={{ marginBottom: '5px' }}>Tienes 4 minutos. Expresa tus ideas sin criticarlas.</li>
        </ul>
      </div>
      <button className="submit-btn" onClick={onStart} style={{ marginTop: '10px' }}>Comenzar Test</button>
    </div>
  );
}

function TestMode({ userId, email, onCompleted }) {
  // Determine duration based on url param for easier testing
  const searchParams = new URLSearchParams(window.location.search);
  const isTest = searchParams.get('test') === 'true';
  const TEST_DURATION_SECONDS = isTest ? 10 : 240;

  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION_SECONDS);
  const [inputValue, setInputValue] = useState('');
  const [responses, setResponses] = useState([]);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef(null);

  // Always keep focus on the input box
  useEffect(() => {
    if (!finished && inputRef.current) {
      inputRef.current.focus();
    }
  }, [finished, inputValue]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (!finished && inputRef.current) {
        inputRef.current.focus();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [finished]);

  // Timer logic
  useEffect(() => {
    let timer = null;
    if (started && timeLeft > 0 && !finished) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [started, timeLeft, finished]);

  const finishTest = async (finalResponses) => {
    setFinished(true);
    setSubmitting(true);

    try {
      await fetch('/api/submit-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email, responses: finalResponses })
      });
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
    if (onCompleted) onCompleted();
  };

  const handleKeyDown = (e) => {
    if (finished) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (inputValue.trim() !== '') {
        if (!started) {
          setStarted(true);
        }
        const newR = { text: inputValue.trim(), timestamp: new Date().toISOString() };
        const newResponses = [...responses, newR];
        setResponses(newResponses);
        setInputValue('');

        // If the time is 0 and they hit enter to send, test finishes
        if (timeLeft === 0) {
          finishTest(newResponses);
        }
      } else if (timeLeft === 0) {
        // if they hit enter on an empty input when time is 0, test finishes
        finishTest(responses);
      }
    }
  };

  const handleChange = (e) => {
    if (finished) return;
    setInputValue(e.target.value);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')} `;
  };

  if (finished) {
    return (
      <div className="card text-center">
        <h1 className="title">Test finalizado</h1>
        <p className="subtitle">{submitting ? 'Guardando respuestas...' : 'Tus respuestas han sido guardadas. ¡Muchas gracias por participar!'}</p>
      </div>
    );
  }

  return (
    <div className="card test-card">
      <h1 className="title">Test de Pensamiento Asociativo</h1>
      <div className="timer" style={{ color: timeLeft <= 10 ? '#ef4444' : '#fff' }}>
        Tiempo: {formatTime(timeLeft)}
      </div>
      <p className="instruction">Escribe todas las asociaciones que se te ocurran.<br />Pulsa <b>Enter o Tabulador</b> para enviar cada respuesta.</p>
      <input
        ref={inputRef}
        type="text"
        className="test-input"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Empieza a escribir aquí..."
        disabled={finished || submitting}
        autoComplete="off"
      />
      {timeLeft === 0 && (
        <p className="warning-text">¡Tiempo agotado! Termina tu frase y pulsa Enter.</p>
      )}
    </div>
  );
}

function AdminMode({ onBack }) {
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState(null);

  const [filterType, setFilterType] = useState('date');
  const [filterNia, setFilterNia] = useState('');
  const [resultsData, setResultsData] = useState(null);
  const [isFetchingResults, setIsFetchingResults] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al obtener datos');
      }
      setStats(data);

      const datesRes = await fetch('/api/admin/dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const datesData = await datesRes.json();
      if (datesRes.ok && Array.isArray(datesData)) {
        setDates(datesData);
        if (datesData.length > 0) setSelectedDate(datesData[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (isHistorical = false) => {
    if (!isHistorical && !selectedDate) return;
    setIsAnalyzing(true);
    setAnalysisMessage(null);
    setError(null);
    try {
      const payload = { email, historical: isHistorical };
      if (!isHistorical) {
          payload.date = selectedDate;
      }
      const res = await fetch('/api/admin/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`El servidor devolvió una respuesta no válida. Detalle: ${text.substring(0, 100)}... (Posible tiempo de espera agotado en Vercel)`);
      }
      if (!res.ok) throw new Error(data.error || 'Error en el análisis');
      setAnalysisMessage({ type: 'success', text: data.message });
    } catch (err) {
      setAnalysisMessage({ type: 'error', text: err.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFetchResults = async () => {
    setIsFetchingResults(true);
    setResultsData(null);
    try {
      const res = await fetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, filterType, filterValue: filterType === 'date' ? selectedDate : '', nia: filterNia })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener resultados');
      setResultsData(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsFetchingResults(false);
    }
  };

  const handleExportExcel = () => {
    if (!resultsData || !resultsData.users) return;

    const exportData = resultsData.users.map(u => ({
      'Email': u.email,
      'NIA': u.nia,
      'Sexo': u.sex || '',
      'Titulación': u.studies || '',
      'Fluidez': u.fluidez,
      'Originalidad Absoluta': u.originalidad,
      'Originalidad Relativa': u.originalidad_relativa ? u.originalidad_relativa.toFixed(2) : '0.00',
      'Flexibilidad Absoluta': u.flexibilidad,
      'Flexibilidad Relativa': u.flexibilidad_relativa ? u.flexibilidad_relativa.toFixed(2) : '0.00',
      'Elaboración': u.elaboracion ? u.elaboracion.toFixed(2) : '0.00',
      'Respuestas': u.respuestas ? u.respuestas.join(' | ') : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados");
    XLSX.writeFile(workbook, `resultados_asociativo_${filterType === 'date' ? selectedDate : 'historico'}.xlsx`);
  };

  if (stats) {
    return (
      <div className="card admin-card">
        <h1 className="title">Test de pensamiento asociativo</h1>
        <h2 className="subtitle" style={{marginBottom: "20px", color: "#60a5fa"}}>Panel de Administración</h2>
        <div className="stats-grid">
          <div className="stat-box">
            <h3>Participantes</h3>
            <p className="stat-value">{stats.totalParticipants}</p>
          </div>
          <div className="stat-box">
            <h3>Máx. Respuestas</h3>
            <p className="stat-value">{stats.maxResponses}</p>
          </div>
          <div className="stat-box">
            <h3>Media por test</h3>
            <p className="stat-value">{stats.avgResponses}</p>
          </div>
        </div>

        <div className="analysis-section" style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <h2 className="title" style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Consultar Analíticas</h2>

          <div className="input-group">
            <label>Tipo de Filtro</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="historical">Histórico Completo</option>
              <option value="date">Por Fecha de Test</option>
            </select>
          </div>

          {filterType === 'date' && (
            <div className="input-group">
              <label>Selecciona la Fecha del Test</label>
              {dates.length > 0 ? (
                <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
                  {dates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : <p>No hay fechas registradas todavía.</p>}
            </div>
          )}

          <div className="input-group">
            <label>Buscar por NIA (opcional)</label>
            <input
              type="text"
              placeholder="Ej: 123456"
              value={filterNia}
              onChange={(e) => setFilterNia(e.target.value)}
            />
          </div>

          <button
            className="submit-btn admin-submit-btn"
            onClick={handleFetchResults}
            disabled={isFetchingResults || (filterType === 'date' && !selectedDate)}
            style={{ marginBottom: '15px', background: '#3b82f6' }}
          >
            {isFetchingResults ? 'Consultando...' : 'Consultar Resultados'}
          </button>

          {resultsData && (
            <div className="results-display" style={{ marginTop: '20px', background: '#1f2937', padding: '15px', borderRadius: '8px', overflowX: 'auto' }}>
              <div style={{ paddingBottom: '15px', marginBottom: '15px', borderBottom: '1px solid #4b5563' }}>
                <h3 style={{ marginBottom: '10px', color: '#60a5fa' }}>Máximos del conjunto</h3>
                <p>Fluidez: <b>{resultsData.max.fluidez}</b> | Originalidad absoluta: <b>{resultsData.max.originalidad}</b> | Originalidad relativa: <b>{resultsData.max.originalidad_relativa?.toFixed(2) || '0.00'}</b></p>
                <p>Flexibilidad absoluta: <b>{resultsData.max.flexibilidad}</b> | Flexibilidad relativa: <b>{resultsData.max.flexibilidad_relativa?.toFixed(2) || '0.00'}</b> | Elaboración: <b>{resultsData.max.elaboracion.toFixed(2)}</b></p>
              </div>

              <h3>Participantes ({resultsData.users.length})</h3>
              <table style={{ width: '100%', textAlign: 'left', marginTop: '10px', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ color: '#9ca3af' }}>
                    <th>Email</th><th>NIA</th><th>Fluidez</th><th>Originalidad absoluta</th><th>Originalidad relativa</th><th>Flexibilidad absoluta</th><th>Flexibilidad relativa</th><th>Elaboración</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsData.users.flatMap(u => {
                    const rows = [
                      <tr key={u.user_id} style={{ borderBottom: (!u.respuestas || u.respuestas.length === 0) ? '1px solid #4b5563' : 'none' }}>
                        <td>{u.email}</td>
                        <td>{u.nia}</td>
                        <td>{u.fluidez}</td>
                        <td>{u.originalidad}</td>
                        <td>{u.originalidad_relativa?.toFixed(2) || '0.00'}</td>
                        <td>{u.flexibilidad}</td>
                        <td>{u.flexibilidad_relativa?.toFixed(2) || '0.00'}</td>
                        <td>{u.elaboracion.toFixed(2)}</td>
                      </tr>
                    ];
                    if (u.respuestas && u.respuestas.length > 0 && filterNia.trim() !== '') {
                      rows.push(
                        <tr key={`resp-${u.user_id}`}>
                          <td colSpan="8" style={{ padding: '4px 8px 12px 8px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem', borderBottom: '1px solid #4b5563' }}>
                            <span style={{ color: '#60a5fa' }}>Respuestas:</span> {u.respuestas.join(' | ')}
                          </td>
                        </tr>
                      );
                    }
                    return rows;
                  })}
                </tbody>
              </table>

              <button
                className="submit-btn"
                onClick={handleExportExcel}
                style={{ marginTop: '20px', background: '#10b981', display: 'block', width: '100%' }}
              >
                Descargar Resultados en Excel
              </button>
            </div>
          )}
        </div>

        <div className="analysis-section" style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <h2 className="title" style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#ef4444' }}>Análisis y Procesamiento con IA</h2>
          <p style={{ fontSize: '0.85rem', marginBottom: '15px', color: '#9ca3af' }}>Esta acción analizará las respuestas nuevas. Si eliges procesar por lote (Fecha), se enviarán correos con los resultados de esa sesión en particular compensados con los analítos del grupo de ese día. Si eliges procesar histórico, todos los datos del sistema se recalcularán juntos para guardarse como el registro de base, pero NO se enviarán correos.</p>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="submit-btn admin-submit-btn"
              onClick={() => handleAnalyze(false)}
              disabled={isAnalyzing || !selectedDate || filterType !== 'date'}
              style={{ flex: 1, minWidth: '200px' }}
            >
              {isAnalyzing && filterType === 'date' ? 'Analizando...' : 'Procesar Fecha y Enviar Correos'}
            </button>

            <button
              className="submit-btn admin-submit-btn"
              onClick={() => handleAnalyze(true)}
              disabled={isAnalyzing}
              style={{ flex: 1, minWidth: '200px', background: '#ec4899' }}
            >
              {isAnalyzing && filterType !== 'date' ? 'Analizando...' : 'Procesar Todo el Histórico (sin correo)'}
            </button>
          </div>

          {analysisMessage && (
            <div className={`alert ${analysisMessage.type}`} style={{ marginTop: '15px', marginBottom: '0' }}>
              {analysisMessage.text}
            </div>
          )}
        </div>

        <button className="submit-btn secondary-btn" onClick={onBack} style={{ marginTop: '20px' }}>Cerrar panel</button>
      </div>
    );
  }

  return (
    <div className="card admin-card">
      <h1 className="title" style={{marginBottom: "5px"}}>Test de pensamiento asociativo</h1>
      <h2 className="subtitle" style={{marginBottom: "20px"}}>Acceso Administrador</h2>
      <form onSubmit={handleLogin} className="form-content">
        {error && <div className="alert error">{error}</div>}
        <div className="input-group">
          <label>Correo Electrónico Autorizado</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@unizar.es"
            required
          />
        </div>
        <button type="submit" className="submit-btn admin-submit-btn" disabled={loading}>
          {loading ? 'Verificando...' : 'Acceder al Panel'}
        </button>
      </form>
      <button className="text-btn" onClick={onBack}>← Volver al registro</button>
    </div>
  );
}

function App() {
  const [step, setStep] = useState(0);
  const [userContext, setUserContext] = useState({ id: null, email: null });

  const [formData, setFormData] = useState({
    email: '',
    nia: '',
    age: '',
    sex: '',
    degree: ''
  });

  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState(null);
  const [errorVisible, setErrorVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCheckUser = async (e) => {
    e.preventDefault();
    if (!identifier) return;
    setLoading(true);
    setErrorVisible(false);
    setMessage(null);

    try {
      const res = await fetch('/api/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error de conexión');

      if (data.exists && data.hasTested) {
         setMessage({ type: 'error', text: 'El usuario introducido ya ha participado en este Test de Pensamiento Alternativo anteriormente. ¡Muchas gracias!' });
         setErrorVisible(true);
      } else {
         if (data.userData) {
           setFormData(data.userData);
         }
         setStep(1);
         setMessage(null);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setErrorVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'age' && value.length > 2) return;
    if (name === 'nia' && value.length > 6) return;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    setErrorVisible(false);
  };

  const validateForm = () => {
    if (!formData.email.endsWith('@unizar.es') && formData.email !== 'ignlopez1968@gmail.com') {
      return "El correo debe utilizar el dominio @unizar.es o ser una cuenta autorizada";
    }
    if (!/^\d{6}$/.test(formData.nia)) {
      return "El NIA debe tener exactamente 6 números";
    }
    if (!/^\d{2}$/.test(formData.age)) {
      return "La edad debe tener exactamente 2 números";
    }
    if (!formData.sex) {
      return "Por favor, selecciona una opción en Sexo";
    }
    if (!formData.degree) {
      return "Por favor, selecciona tu Titulación EINA";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      setMessage({ type: 'error', text: error });
      setErrorVisible(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al conectar con la base de datos');
      }

      setUserContext({ id: data.id, email: formData.email });
      setStep(2);

    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setErrorVisible(true);
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="container">
        <InstructionsMode onStart={() => setStep(3)} />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="container">
        <TestMode userId={userContext.id} email={userContext.email} onCompleted={() => { }} />
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="container">
        <AdminMode onBack={() => setStep(0)} />
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="container">
        <div className="card">
          <h1 className="title">Test de Creatividad / Pensamiento Asociativo</h1>
          <p className="subtitle">Por favor, identifícate con tu Email o NIA para empezar</p>
          
          {message && errorVisible && (
            <div className={`alert ${message.type}`}>
              {message.text}
            </div>
          )}
          
          <form onSubmit={handleCheckUser} className="form-content">
            <div className="input-group">
              <label>Introduce tu correo (@unizar.es) o tu NIA de 6 dígitos</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setErrorVisible(false); }}
                placeholder="Ejemplo: 123456 o usuario@unizar.es"
                required
                autoFocus
              />
            </div>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Buscando...' : 'Siguiente'}
            </button>
          </form>
          <div className="admin-link-container">
            <button className="admin-access-btn" onClick={() => setStep(4)}>
              ⚡ Acceso Administrador
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Confirma tus Datos</h1>
        <p className="subtitle">Revisa tu información antes de acceder al test interactivo</p>

        {message && errorVisible && (
          <div className={`alert ${message.type} `}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-content">
          <div className="input-group">
            <label>Dirección de correo electrónico</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="ejemplo@unizar.es"
              required
            />
            <small>Dominio @unizar.es o cuenta autorizada</small>
          </div>

          <div className="row">
            <div className="input-group">
              <label>NIA</label>
              <input
                type="number"
                name="nia"
                value={formData.nia}
                onChange={handleChange}
                placeholder="6 dígitos"
                required
              />
            </div>

            <div className="input-group">
              <label>Edad</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="2 dígitos"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Sexo</label>
            <select name="sex" value={formData.sex} onChange={handleChange} required>
              <option value="" disabled>Selecciona una opción</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Prefiero no decirlo">Prefiero no decirlo</option>
            </select>
          </div>

          <div className="input-group">
            <label>Titulación EINA</label>
            <select name="degree" value={formData.degree} onChange={handleChange} required>
              <option value="" disabled>Selecciona tu titulación</option>
              {studiesOptions.map((study, idx) => (
                <option key={idx} value={study}>{study}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Preparando test...' : 'Comenzar Test'}
          </button>
        </form>

        <div className="admin-link-container" style={{textAlign: 'center', marginTop: '15px'}}>
          <button className="text-btn" onClick={() => setStep(0)}>
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
