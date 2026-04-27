import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
let supabaseErrorMsg = null;
try {
    if (!supabaseUrl || !supabaseKey) {
        supabaseErrorMsg = "Missing Supabase configuration: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY";
        console.error(supabaseErrorMsg);
    } else {
        supabase = createClient(supabaseUrl, supabaseKey);
    }
} catch (e) {
    supabaseErrorMsg = "Fallo crítico al inicializar Supabase: " + e.message;
    console.error(supabaseErrorMsg);
}

function cleanText(text) {
    if (!text || typeof text !== 'string') return "";
    let cleaned = text.toLowerCase();
    cleaned = cleaned.replace(/<[^>]*>?/gm, '');
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    cleaned = cleaned.replace(/www\.[^\s]+/g, '');
    cleaned = cleaned.replace(/[^a-záéíóúñü0-9\s]/gi, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

// Endpoint to verify user and prevent test duplication
app.post('/api/check-user', async (req, res) => {
    const { identifier } = req.body;
    if (!supabase) return res.status(500).json({ error: "DB Error" });
    if (!identifier) return res.status(400).json({ error: "Campo vacío" });

    let query = supabase.from('users').select('id, email, nia, age, sex, degree');
    if (identifier.includes('@')) {
        query = query.eq('email', identifier.trim());
    } else {
        query = query.eq('nia', identifier.trim());
    }

    const { data: users, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    if (users && users.length > 0) {
        const user = users[0];
        const { data: tests } = await supabase.from('pa_test_responses').select('id').eq('user_id', user.id).limit(1);
        const hasTested = tests && tests.length > 0;
        
        return res.json({ 
            exists: true, 
            hasTested, 
            userData: {
                email: user.email,
                nia: user.nia || '',
                age: user.age ? user.age.toString() : '',
                sex: user.sex || '',
                degree: user.degree || ''
            }
        });
    } else {
        const isEmail = identifier.includes('@');
        return res.json({
            exists: false,
            hasTested: false,
            userData: {
                email: isEmail ? identifier : '',
                nia: !isEmail && /^\d+$/.test(identifier) ? identifier : '',
                age: '', sex: '', degree: ''
            }
        });
    }
});

// Endpoint to register a new user
app.post('/api/register', async (req, res) => {
    const { email, nia, age, sex, degree } = req.body;
    
    // Add debugging check
    if (!supabase) {
        return res.status(500).json({ error: supabaseErrorMsg || "La base de datos no está conectada. Entorno vacío." });
    }

    if (!email || (!email.endsWith('@unizar.es') && email !== 'ignlopez1968@gmail.com')) {
        return res.status(400).json({ error: 'El correo debe usar el dominio @unizar.es o ser una cuenta autorizada' });
    }

    if (!/^\d{6}$/.test(nia)) {
        return res.status(400).json({ error: 'El NIA debe tener 6 dígitos' });
    }

    if (!/^\d{2}$/.test(age)) {
        return res.status(400).json({ error: 'La edad debe tener 2 dígitos' });
    }

    // UPSERT: Insert or map existing user by resolving by email
    const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
    
    if (existingUser) {
        // Option 1: Update the user's NIA and info just in case they were previously registered with slightly different studies
        await supabase
            .from('users')
            .update({ nia: nia, age: parseInt(age), sex, degree: degree })
            .eq('id', existingUser.id);
            
        return res.status(200).json({ success: true, message: 'Usuario existente recuperado', id: existingUser.id });
    }

    // Creating new user
    const { data, error } = await supabase
        .from('users')
        .insert([{ email, nia: nia, age: parseInt(age), sex, degree: degree }])
        .select()
        .single();

    if (error) {
        return res.status(500).json({ error: 'Error del servidor al guardar los datos: ' + error.message });
    }

    res.status(201).json({ success: true, message: 'Registro exitoso', id: data.id });
});

// Endpoint to submit test
app.post('/api/submit-test', async (req, res) => {
    let { userId, email, responses } = req.body;

    if (!supabase) {
        return res.status(500).json({ error: supabaseErrorMsg || "La base de datos no está conectada. Entorno vacío." });
    }

    if (!userId || !responses || !Array.isArray(responses)) {
        return res.status(400).json({ error: 'Datos no válidos' });
    }

    const cleanedResponses = responses.map((resp, index) => ({
        user_id: userId,
        response_number: index + 1,
        response_text: cleanText(resp.text),
        timestamp: resp.timestamp || new Date().toISOString()
    })).filter(resp => resp.response_text !== "");

    if (cleanedResponses.length > 0) {
        const { error } = await supabase
            .from('pa_test_responses')
            .insert(cleanedResponses);
            
        if (error) {
             console.error("Error inserting test responses:", error);
             return res.status(500).json({ error: 'Error al guardar el test' });
        }
    }

    res.status(200).json({ success: true, message: 'Test guardado con éxito' });
});

const ALLOWED_ADMINS = ['ignlopez@unizar.es', 'ignlopez1968@gmail.com'];

// Endpoint for Admin Stats
app.post('/api/admin/stats', async (req, res) => {
    const { email } = req.body;
    if (!email || !ALLOWED_ADMINS.includes(email.toLowerCase())) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { data: testResponses, error } = await supabase.from('pa_test_responses').select('user_id');
    
    if (error) {
        return res.status(500).json({ error: 'Error base de datos' });
    }
    
    const userCounts = {};
    for (const row of testResponses) {
        userCounts[row.user_id] = (userCounts[row.user_id] || 0) + 1;
    }
    
    const users = Object.keys(userCounts);
    const totalParticipants = users.length;
    let maxResponses = 0;
    let sumResponses = 0;
    
    for (const uid of users) {
        const count = userCounts[uid];
        sumResponses += count;
        if (count > maxResponses) maxResponses = count;
    }
    
    const avgResponses = totalParticipants > 0 ? (sumResponses / totalParticipants).toFixed(2) : 0;

    res.status(200).json({
        totalParticipants,
        maxResponses,
        avgResponses: parseFloat(avgResponses)
    });
});

app.post('/api/admin/dates', async (req, res) => {
    const { email } = req.body;
    if (!email || !ALLOWED_ADMINS.includes(email.toLowerCase())) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const { data, error } = await supabase.from('pa_test_responses').select('timestamp');
    if (error) return res.status(500).json({ error: 'Database error' });
    
    const dates = [...new Set(data.map(r => new Date(r.timestamp).toISOString().substring(0, 10)))];
    dates.sort().reverse();
    
    res.json(dates);
});

app.post('/api/admin/results', async (req, res) => {
    const { email, filterType, filterValue, nia } = req.body;
    if (!email || !ALLOWED_ADMINS.includes(email.toLowerCase())) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    let usersQuery = supabase.from('users').select('*');
    if (nia && nia.trim() !== '') {
        usersQuery = usersQuery.eq('nia', nia.trim());
    }
    const { data: users, error: usersError } = await usersQuery;
    if (usersError) return res.status(500).json({ error: 'Database error fetching users' });

    const { data: responsesRaw, error: responsesError } = await supabase
        .from('pa_test_responses')
        .select('id, user_id, response_text, timestamp, pa_response_analysis(category)');
    
    if (responsesError) return res.status(500).json({ error: 'Database error fetching responses' });

    let responses = responsesRaw;
    if (filterType === 'date' && filterValue) {
        responses = responses.filter(r => r.timestamp && r.timestamp.startsWith(filterValue));
    }

    const flatResponses = responses.map(r => ({
        id: r.id,
        user_id: r.user_id,
        response_text: r.response_text,
        category: r.pa_response_analysis && r.pa_response_analysis.category ? r.pa_response_analysis.category : 
                 (Array.isArray(r.pa_response_analysis) && r.pa_response_analysis.length > 0 ? r.pa_response_analysis[0].category : null),
        timestamp: r.timestamp
    }));

    const categoryCounts = {};
    for (const br of flatResponses) {
        if (br.category) {
            if (!categoryCounts[br.category]) categoryCounts[br.category] = 0;
            categoryCounts[br.category] += 1;
        }
    }
    const uniqueCategories = new Set(Object.keys(categoryCounts).filter(cat => categoryCounts[cat] === 1));

    const userStats = {};
    for (const br of flatResponses) {
        if (!userStats[br.user_id]) {
            userStats[br.user_id] = {
                fluidez: 0,
                categories: new Set(),
                total_words: 0,
                originalidad: 0,
                originalidad_relativa: 0,
                respuestas_textos: []
            };
        }
        userStats[br.user_id].fluidez += 1;
        userStats[br.user_id].respuestas_textos.push(br.response_text);
        if (br.category) userStats[br.user_id].categories.add(br.category);
        userStats[br.user_id].total_words += br.response_text.split(/\s+/).filter(w => w.length > 0).length;
        if (br.category && categoryCounts[br.category]) {
            if (uniqueCategories.has(br.category)) {
                userStats[br.user_id].originalidad += 1;
            }
            userStats[br.user_id].originalidad_relativa += (1 / categoryCounts[br.category]);
        }
    }

    const finalUsers = [];
    const absoluteTotalCategories = Object.keys(categoryCounts).length;
    let fluidezMax = 0, originalidadMax = 0, originalidadRelativaMax = 0, flexibilidadMax = 0, elaboracionMax = 0, flexibilidadRelMax = 0;

    for (const u of users) {
        const stats = userStats[u.id];
        
        let fluidez = stats ? stats.fluidez : 0;
        if (fluidez === 0 && (filterType === 'date' || (nia && nia.trim()))) {
             continue;
        }

        let flexibilidad = stats ? stats.categories.size : 0;
        let flexibilidad_relativa = absoluteTotalCategories > 0 ? (flexibilidad / absoluteTotalCategories) : 0;
        let originalidad = stats ? stats.originalidad : 0;
        let originalidad_relativa = stats ? stats.originalidad_relativa : 0;
        let elaboracion = fluidez > 0 ? stats.total_words / fluidez : 0;
        
        if (fluidez > fluidezMax) fluidezMax = fluidez;
        if (originalidad > originalidadMax) originalidadMax = originalidad;
        if (originalidad_relativa > originalidadRelativaMax) originalidadRelativaMax = originalidad_relativa;
        if (flexibilidad > flexibilidadMax) flexibilidadMax = flexibilidad;
        if (flexibilidad_relativa > flexibilidadRelMax) flexibilidadRelMax = flexibilidad_relativa;
        if (elaboracion > elaboracionMax) elaboracionMax = elaboracion;

        finalUsers.push({
            user_id: u.id,
            email: u.email,
            nia: u.nia,
            age: u.age,
            sex: u.sex,
            studies: u.degree,
            fluidez,
            flexibilidad,
            flexibilidad_relativa,
            originalidad,
            originalidad_relativa,
            elaboracion,
            respuestas: stats ? stats.respuestas_textos : []
        });
    }

    finalUsers.sort((a, b) => b.fluidez - a.fluidez);

    res.json({
        users: finalUsers,
        max: { 
            fluidez: fluidezMax, 
            originalidad: originalidadMax, 
            originalidad_relativa: originalidadRelativaMax,
            flexibilidad: flexibilidadMax, 
            flexibilidad_relativa: flexibilidadRelMax,
            elaboracion: elaboracionMax 
        }
    });
});

app.post('/api/admin/analyze', async (req, res) => {
    const { email, date, historical } = req.body;
    if (!email || !ALLOWED_ADMINS.includes(email.toLowerCase())) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    if (!historical && !date) return res.status(400).json({ error: 'Falta la fecha' });

    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en el backend.' });
        }
        if (!historical && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
            return res.status(500).json({ error: 'Faltan credenciales de EMAIL (EMAIL_USER y EMAIL_PASS).' });
        }

        // Fetch test_responses
        const { data: responsesRaw, error: rError } = await supabase
            .from('pa_test_responses')
            .select('id, user_id, response_text, timestamp, users!inner(email)');
            
        if (rError) return res.status(500).json({ error: 'Database error fetching responses: ' + rError.message });
        
        let rows = responsesRaw.filter(r => r.response_text && r.response_text.trim() !== '');
        
        // Filter by date prefix if not historical
        if (!historical && date) {
            rows = rows.filter(r => r.timestamp && r.timestamp.startsWith(date));
        }

        if (!rows || rows.length === 0) return res.status(404).json({ error: 'No hay respuestas para analizar' });

        // Get existing categories
        const { data: catData } = await supabase.from('pa_response_analysis').select('response_id, category');
        const existingCategoriesMap = {};
        const analyzedIds = new Set();
        const aiMap = {};
        
        if (catData) {
            catData.forEach(c => { 
                if (c.category) {
                    existingCategoriesMap[c.category] = true;
                    if (c.response_id) {
                        aiMap[c.response_id] = { response_id: c.response_id, category: c.category };
                    }
                }
                if (c.response_id) analyzedIds.add(c.response_id);
            });
        }
        const existingCategories = Object.keys(existingCategoriesMap);

        const rowsToAnalyze = rows.filter(r => !analyzedIds.has(r.id));
        let aiData = [];

        if (rowsToAnalyze.length > 0) {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

            let promptText = `Analiza las siguientes asociaciones de palabras generadas por individuos en un test de creatividad (Test de Pensamiento Asociativo).
Para cada respuesta, determina:
1. "category": a qué categoría semántica general pertenece (1-2 palabras, en minúsculas).

IMPORTANTE: Reutiliza estas categorías existentes si encajan perfectamente: [${existingCategories.join(', ')}]. Si la respuesta es completamente nueva y no encaja, inventa una categoría nueva lo más genérica posible.

Lista de respuestas:\n`;
            rowsToAnalyze.forEach(r => {
                promptText += `[ID: ${r.id}] - Texto: "${r.response_text}"\n`;
            });
            promptText += `\nDevuelve SOLAMENTE un array JSON válido, usando comillas dobles en las claves (no uses markdown), p. ej: [{"response_id": 1, "category": "decoración"}]\n`;

            let retries = 6;
            let success = false;
            let lastError = null;
            let waitTime = 5000; // start with 5 seconds

            while (retries > 0 && !success) {
                try {
                    // Use only gemini-2.5-flash which is the model available in this API scope
                    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                    
                    const result = await model.generateContent(promptText);
                    let responseText = result.response.text().trim();

                    if (responseText.startsWith('```json')) {
                        responseText = responseText.replace(/^```json/m, '').replace(/```$/m, '').trim();
                    } else if (responseText.startsWith('```')) {
                        responseText = responseText.replace(/^```/m, '').replace(/```$/m, '').trim();
                    }

                    aiData = JSON.parse(responseText);
                    
                    aiData.forEach(item => {
                        const respId = parseInt(item.response_id, 10) || parseInt(item.id, 10);
                        aiMap[respId] = item;
                    });
                    success = true;
                } catch (geminiErr) {
                    lastError = geminiErr;
                    console.warn(`Gemini API Error usando modelo (Intentos restantes: ${retries - 1}):`, geminiErr.message);
                    retries--;
                    if (retries > 0) {
                        console.log(`Esperando ${waitTime / 1000} segundos antes de reintentar...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        waitTime *= 2; // Exponential backoff (5s, 10s, 20s, 40s, 80s)
                    }
                }
            }

            if (!success) {
                return res.status(500).json({ error: 'Fallo al contactar con la IA tras varios intentos: ' + (lastError ? lastError.message : 'Error desconocido') });
            }
        }

        const categoryCounts = {};
        rows.forEach(r => {
            const aiInfo = aiMap[r.id];
            if (aiInfo && aiInfo.category) {
                const cat = aiInfo.category.toLowerCase().trim();
                if (!categoryCounts[cat]) categoryCounts[cat] = 0;
                categoryCounts[cat] += 1;
            }
        });
        const uniqueCategories = new Set(Object.keys(categoryCounts).filter(cat => categoryCounts[cat] === 1));

        const userStats = {};
        rows.forEach(r => {
            if (!userStats[r.user_id]) {
                const userEmail = Array.isArray(r.users) ? r.users[0].email : r.users.email;
                userStats[r.user_id] = {
                    user_id: r.user_id,
                    email: userEmail,
                    responses: 0,
                    wordsCount: 0,
                    originalCount: 0,
                    originalRel: 0,
                    categories: new Set()
                };
            }
            const u = userStats[r.user_id];
            u.responses += 1;
            u.wordsCount += r.response_text.split(/\s+/).filter(w => w.length > 0).length;

            const aiInfo = aiMap[r.id];
            if (aiInfo && aiInfo.category) {
                const cat = aiInfo.category.toLowerCase().trim();
                if (uniqueCategories.has(cat)) u.originalCount += 1;
                if (categoryCounts[cat]) u.originalRel += (1 / categoryCounts[cat]);
                u.categories.add(cat);
            }
        });

        const statsList = Object.values(userStats);
        const totalUsers = statsList.length;
        const totalResponses = statsList.reduce((acc, curr) => acc + curr.responses, 0);
        const meanResponses = totalUsers > 0 ? (totalResponses / totalUsers) : 0;
        const absoluteTotalCategories = Object.keys(categoryCounts).length;

        let maxFluidez = 0, maxOriginalidad = 0, maxOriginalidadRel = 0, maxFlexibilidad = 0, maxElaboracion = 0, maxFlexibilidadRel = 0;

        statsList.forEach(u => {
            u.fluidez = u.responses;
            u.originalidad = u.originalCount;
            u.originalidad_relativa = u.originalRel;
            u.flexibilidad = u.categories.size;
            u.flexibilidad_relativa = absoluteTotalCategories > 0 ? (u.flexibilidad / absoluteTotalCategories) : 0;
            u.elaboracion = u.fluidez > 0 ? (u.wordsCount / u.fluidez) : 0;

            if (u.fluidez > maxFluidez) maxFluidez = u.fluidez;
            if (u.originalidad > maxOriginalidad) maxOriginalidad = u.originalidad;
            if (u.originalidad_relativa > maxOriginalidadRel) maxOriginalidadRel = u.originalidad_relativa;
            if (u.flexibilidad > maxFlexibilidad) maxFlexibilidad = u.flexibilidad;
            if (u.flexibilidad_relativa > maxFlexibilidadRel) maxFlexibilidadRel = u.flexibilidad_relativa;
            if (u.elaboracion > maxElaboracion) maxElaboracion = u.elaboracion;
        });

        const analysisInserts = [];
        const isoNow = new Date().toISOString();
        aiData.forEach(item => {
            if (item.category && item.response_id) {
                analysisInserts.push({
                    response_id: parseInt(item.response_id, 10) || parseInt(item.id, 10),
                    category: item.category.toLowerCase().trim(),
                    date_analyzed: isoNow
                });
            }
        });
        if (analysisInserts.length > 0) {
            await supabase.from('pa_response_analysis').upsert(analysisInserts);
        }

        const analysisDate = historical ? 'Histórico' : date;

        // Update analysis_results - UPSERT natively supported in Supabase
        const resultsInserts = statsList.map(u => ({
            user_id: u.user_id,
            date: analysisDate,
            fluidez: u.fluidez,
            originalidad: u.originalidad,
            originalidad_relativa: u.originalidad_relativa,
            flexibilidad: u.flexibilidad,
            elaboracion: u.elaboracion
        }));
        
        if (resultsInserts.length > 0) {
            // Need to make sure unique constraint is matched, otherwise it inserts duplicate.
            // On conflict updates. Supabase JS upsert defaults to all unique columns.
            await supabase.from('pa_analysis_results').upsert(resultsInserts, { onConflict: 'user_id,date' });
        }

        const emailErrors = [];

        if (!historical) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            for (const u of statsList) {
                const tpoFluidez = maxFluidez > 0 ? (u.fluidez / maxFluidez).toFixed(2) : 0;
                const tpoOriginalidad = maxOriginalidad > 0 ? (u.originalidad / maxOriginalidad).toFixed(2) : 0;
                const tpoOriginalidadRel = maxOriginalidadRel > 0 ? (u.originalidad_relativa / maxOriginalidadRel).toFixed(2) : 0;
                const tpoFlexibilidad = maxFlexibilidad > 0 ? (u.flexibilidad / maxFlexibilidad).toFixed(2) : 0;
                const tpoFlexibilidadRel = maxFlexibilidadRel > 0 ? (u.flexibilidad_relativa / maxFlexibilidadRel).toFixed(2) : 0;
                const tpoElaboracion = maxElaboracion > 0 ? (u.elaboracion / maxElaboracion).toFixed(2) : 0;

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: u.email,
                    subject: 'Resultados de tu Test de Pensamiento Asociativo',
                    text: `Hola,\n\nEstos son los resultados de tu test de creatividad realizado el ${date}:\n\n` +
                        `Número total de tus respuestas (Fluidez): ${u.fluidez}\n` +
                        `Número de respuestas promedio del grupo: ${meanResponses.toFixed(2)}\n\n` +
                        `Evaluación de tus Indicadores (valor / tanto por uno respecto al máximo del grupo):\n` +
                        `- Fluidez: ${u.fluidez} / ${tpoFluidez}\n` +
                        `- Originalidad (Absoluta): ${u.originalidad} / ${tpoOriginalidad}\n` +
                        `- Originalidad (Relativa): ${u.originalidad_relativa.toFixed(2)} / ${tpoOriginalidadRel}\n` +
                        `- Flexibilidad (Absoluta): ${u.flexibilidad} / ${tpoFlexibilidad}\n` +
                        `- Flexibilidad (Relativa): ${u.flexibilidad_relativa.toFixed(2)} / ${tpoFlexibilidadRel}\n` +
                        `- Elaboración: ${u.elaboracion.toFixed(2)} / ${tpoElaboracion}\n\n` +
                        `Originalidad absoluta es el número de respuestas únicas en tu grupo para la fecha del test. Originalidad relativa es el sumatorio de las frecuencias de originalidad de cada respuesta.\n` +
                        `Flexibilidad absoluta es el número de categorías distintas que cubren tus respuestas, y Flexibilidad relativa es su proporción frente a todo el grupo.\n` +
                        `Elaboración es el promedio de palabras por idea.\n\n` +
                        `¡Gracias por participar!`
                };

                try {
                    await transporter.sendMail(mailOptions);
                } catch (e) {
                    console.error("Error enviando email a", u.email, e);
                    emailErrors.push(e.message);
                }
            }
        }

        let message = `Análisis completados para ${totalUsers} participantes.`;
        if (emailErrors.length > 0) {
            message += `\nPero hubo ERROR al enviar correos (Google bloqueado, usar contraseña de aplicación). Error tipo: ${emailErrors[0]}`;
        }

        res.json({ success: true, message: message });
    } catch (e) {
        console.error("Global Error:", e);
        res.status(500).json({ error: 'Error durante el análisis: ' + e.message });
    }
});
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Servidor local ejecutándose en http://localhost:${port}`);
    });
}

export default app;
