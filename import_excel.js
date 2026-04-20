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
const startIdx = header.indexOf('1');
if (startIdx === -1) {
    console.error("No se encontraron columnas de respuestas ('1').");
    process.exit(1);
}

db.serialize(() => {
    // We can clear test_responses and users to avoid overlaps if necessary,
    // but better to just insert them if they don't exist.
    // For safety, let's sync users first.
    db.run('BEGIN TRANSACTION');

    const insertUserStmt = db.prepare(`INSERT OR IGNORE INTO users (email, nia, age, sex, degree) VALUES (?, ?, ?, ?, ?)`);

    data.slice(1).forEach(row => {
        if (!row || row.length === 0) return;
        const email = row[1] || '';
        const degree = row[2] || '';
        const nia = row[3] ? row[3].toString() : '';
        const age = row[4] ? row[4].toString() : '';
        const sex = row[5] || '';
        if (email) {
            insertUserStmt.run([email.toLowerCase().trim(), nia, age, sex, degree]);
        }
    });
    insertUserStmt.finalize();
    db.run('COMMIT');
});

// Second pass: Insert responses
db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.all(`SELECT id, email FROM users`, [], (err, rows) => {
        if (err) throw err;
        const userMap = {};
        rows.forEach(r => userMap[r.email] = r.id);

        const insertStmt = db.prepare(`INSERT INTO test_responses (user_id, response_number, response_text, timestamp) VALUES (?, ?, ?, ?)`);

        data.slice(1).forEach(row => {
            if (!row || row.length === 0) return;
            const email = (row[1] || '').toLowerCase().trim();
            const userId = userMap[email];
            if (!userId) return;

            let respIndex = 1;
            for (let c = startIdx; c < header.length; c += 2) {
                const text = row[c] ? row[c].toString().trim() : '';
                const timeCol = c + 1;
                // Just fallback to the `marca temporal` if time doesn't exist.
                let t = row[timeCol] ? row[timeCol] : row[0];
                let timeStr = t;
                if (t instanceof Date) {
                    timeStr = t.toISOString().replace('T', ' ').substring(0, 19);
                } else if (typeof t === 'string' && t.includes('/')) {
                    // Try naive format fix DD/MM/YYYY
                    timeStr = t;
                }

                if (text) {
                    insertStmt.run([userId, respIndex, text, timeStr]);
                    respIndex++;
                }
            }
        });
        insertStmt.finalize();
        db.run('COMMIT', () => console.log('Imported all responses.'));
    });
});
