import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from '@google/generative-ai';
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('database.sqlite');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function analyzeAll() {
    await new Promise(r => db.run('CREATE TABLE IF NOT EXISTS response_analysis (response_id INTEGER PRIMARY KEY, category TEXT, date_analyzed TEXT)', r));
    return new Promise((resolve, reject) => {
        // Fetch all responses NOT yet in response_analysis
        db.all(`
            SELECT r.id as response_id, r.response_text 
            FROM test_responses r
            LEFT JOIN response_analysis a ON r.id = a.response_id
            WHERE a.response_id IS NULL AND r.response_text != ''
        `, async (err, rows) => {
            if (err) return reject(err);
            if (rows.length === 0) {
                console.log("No unanalyzed responses found.");
                return resolve();
            }

            console.log(`Found ${rows.length} unanalyzed responses...`);

            // To assist Gemini in standardizing categories, let's fetch existing categories
            const existingCategorites = new Set();
            try {
                const cats = await new Promise((res, rej) => db.all(`SELECT DISTINCT category FROM response_analysis`, (e, r) => e ? rej(e) : res(r)));
                cats.forEach(c => { if (c.category) existingCategorites.add(c.category); });
            } catch (e) { }

            // We batch them by 50 to avoid prompt overload
            const batchSize = 50;
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                let promptText = `Asigna una única categoría semántica (1-2 palabras, en minúsculas) que represente el significado principal de cada respuesta del test de Uso Alternativo. Usa las categorías sugeridas si aplican adecuadamente, si no, inventa una general.
Sugerencias: ${Array.from(existingCategorites).join(', ')}.

Lista de respuestas:\n`;
                batch.forEach(r => {
                    promptText += `[ID: ${r.response_id}] - Texto: "${r.response_text}"\n`;
                });
                promptText += `\nDevuelve SOLAMENTE un array JSON válido, p. ej: [{"response_id": 1, "category": "decoración"}]\n`;

                console.log(`Analyzing batch ${i / batchSize + 1} (${batch.length} items)...`);

                try {
                    const result = await model.generateContent(promptText);
                    let responseText = result.response.text().trim();
                    if (responseText.startsWith('\`\`\`json')) responseText = responseText.replace(/^\`\`\`json/m, '');
                    if (responseText.startsWith('\`\`\`')) responseText = responseText.replace(/^\`\`\`/m, '');
                    responseText = responseText.replace(/\`\`\`$/m, '').trim();

                    const aiData = JSON.parse(responseText);

                    // Insert to DB
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');
                        const stmt = db.prepare(`INSERT OR REPLACE INTO response_analysis (response_id, category, date_analyzed) VALUES (?, ?, ?)`);
                        const dateStr = new Date().toISOString();

                        aiData.forEach(item => {
                            if (item.category) {
                                let c = item.category.toLowerCase().trim();
                                existingCategorites.add(c);
                                stmt.run([item.response_id, c, dateStr]);
                            }
                        });
                        stmt.finalize();
                        db.run('COMMIT');
                    });
                } catch (geminiErr) {
                    console.error("Gemini Error on batch:", geminiErr);
                    // Just wait and continue
                }

                // Sleep to avoid rate limits
                await new Promise(r => setTimeout(r, 2000));
            }
            resolve();
        });
    });
}

analyzeAll().then(() => console.log('Done.')).catch(e => console.error(e));
