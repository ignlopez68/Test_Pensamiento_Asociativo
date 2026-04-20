import sqlite3 from 'sqlite3';
import xlsx from 'xlsx';
import path from 'path';

const db = new sqlite3.Database('database.sqlite');
const filePath = path.resolve('Pensamiento Alternativo (respuestas).xlsx');
const workbook = xlsx.readFile(filePath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' });

const header = data[0];
// Trim empty trailing cells in header
while (header.length > 0 && String(header[header.length - 1]).trim() === '') {
    header.pop();
}

const startIdx = header.indexOf('1');

db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM test_responses');
    db.run('DELETE FROM response_analysis');
    db.run('DELETE FROM analysis_results');

    // First load all users to memory map so we can look up quickly
    db.all(`SELECT id, email FROM users`, [], (err, rows) => {
        if (err) throw err;
        const userMap = {};
        rows.forEach(r => userMap[r.email] = r.id);

        const insertStmt = db.prepare(`INSERT INTO test_responses (user_id, response_number, response_text, timestamp) VALUES (?, ?, ?, ?)`);

        data.slice(1).forEach(row => {
            if (!row || row.length === 0) return;
            const email = (row[1] || '').toLowerCase().trim();
            const userId = userMap[email];
            if (!userId) return; // Users should already exist

            let respIndex = 1;

            // Iterate over all headers starting from '1'
            for (let c = startIdx; c < header.length; c++) {
                const headText = String(header[c]).trim();

                // If the header is a number like '1', '2', etc.
                if (!isNaN(headText) && headText !== '') {
                    const text = row[c] ? row[c].toString().trim() : '';
                    if (text) {
                        // Find if there's a corresponding 'Tiempo N' column
                        const timeHeaderStr = `Tiempo ${headText}`;
                        const timeColIdx = header.indexOf(timeHeaderStr);

                        let timeStr = null;
                        if (timeColIdx !== -1 && row[timeColIdx]) {
                            const t = row[timeColIdx];
                            if (t instanceof Date) {
                                timeStr = t.toISOString().replace('T', ' ').substring(0, 19);
                            } else {
                                timeStr = String(t);
                            }
                        } else {
                            // Fallback to absolute timestamp
                            const mt = row[0];
                            if (mt instanceof Date) {
                                timeStr = mt.toISOString().replace('T', ' ').substring(0, 19);
                            } else {
                                timeStr = String(mt);
                            }
                        }

                        // Clean text the same way clean_excel does just in case
                        let cleaned = text.toLowerCase();
                        cleaned = cleaned.replace(/<[^>]*>?/gm, '');
                        cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
                        cleaned = cleaned.replace(/www\.[^\s]+/g, '');
                        cleaned = cleaned.replace(/[^a-záéíóúñü0-9\s]/gi, ' ');
                        cleaned = cleaned.replace(/\s+/g, ' ').trim();

                        if (cleaned) {
                            insertStmt.run([userId, respIndex, cleaned, timeStr]);
                            respIndex++;
                        }
                    }
                }
            }
        });
        insertStmt.finalize();
        db.run('COMMIT', () => console.log('Imported all correctly responses.'));
    });
});
