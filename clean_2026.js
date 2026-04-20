import sqlite3 from 'sqlite3';
import xlsx from 'xlsx';
import path from 'path';

const db = new sqlite3.Database('database.sqlite');

// 1. Delete from SQLite
db.serialize(() => {
    db.run(`DELETE FROM test_responses WHERE timestamp LIKE '2026-02-%' OR timestamp LIKE '2026-03-%'`);
    db.run(`DELETE FROM analysis_results WHERE date LIKE '2026-02-%' OR date LIKE '2026-03-%'`);
    console.log('Deleted SQLite test_responses and analysis_results for Feb and Mar 2026');
});

// 2. Delete and format Excel
const filePath = path.resolve('Pensamiento Alternativo (respuestas).xlsx');
const workbook = xlsx.readFile(filePath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'dd/mm/yyyy hh:mm:ss' });

const header = data[0];
const newData = [header];

for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    const marcaTemporal = row[0];
    let dateObj;
    if (marcaTemporal instanceof Date) {
        dateObj = marcaTemporal;
    } else if (typeof marcaTemporal === 'string') {
        // Assume format is like "DD/MM/YYYY HH:mm:ss" if parsed wrong
        const parts = marcaTemporal.split(/[\s/:]+/);
        if (parts.length >= 3) {
            // Very naive parse, depends on format. It's better to log it if it fails
            dateObj = new Date(marcaTemporal);
        }
    }

    // Check if Feb or Mar 2026
    let skip = false;
    if (dateObj && !isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1; // 1-12
        if (year === 2026 && (month === 2 || month === 3)) {
            skip = true;
        }
    }
    if (skip) continue;

    // Ensure formatting
    if (row[3] !== undefined && row[3] !== '') row[3] = parseInt(row[3], 10); // NIA
    if (row[4] !== undefined && row[4] !== '') row[4] = parseInt(row[4], 10); // EDAD

    // Force date object for everything that represents a date
    if (!(row[0] instanceof Date) && dateObj && !isNaN(dateObj)) {
        row[0] = dateObj;
    }

    // Convert time cells to Date if they are strings
    for (let c = 6; c < row.length; c++) {
        const h = header[c];
        if (h && typeof h === 'string' && h.startsWith('Tiempo')) {
            if (row[c] && typeof row[c] === 'string') {
                const d = new Date(row[c]);
                if (!isNaN(d.getTime())) {
                    row[c] = d;
                }
            }
        }
    }

    newData.push(row);
}

const newWorksheet = xlsx.utils.aoa_to_sheet(newData, { cellDates: true });

const range = xlsx.utils.decode_range(newWorksheet['!ref']);
for (let c = 0; c <= range.e.c; ++c) {
    const h = header[c];
    const isDateCol = (c === 0) || (h && typeof h === 'string' && h.startsWith('Tiempo'));
    if (isDateCol) {
        for (let r = 1; r <= range.e.r; ++r) {
            const cell = xlsx.utils.encode_cell({ r, c });
            if (newWorksheet[cell]) {
                newWorksheet[cell].z = 'dd/mm/yyyy hh:mm:ss';
            }
        }
    }
}

workbook.Sheets[sheetName] = newWorksheet;
xlsx.writeFile(workbook, filePath);
console.log('Cleaned Excel successfully.');
