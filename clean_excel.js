import xlsx from 'xlsx';
import path from 'path';

function cleanText(text) {
    if (!text || typeof text !== 'string') return "";
    let cleaned = text.toLowerCase();
    // HTML tags
    cleaned = cleaned.replace(/<[^>]*>?/gm, '');
    // URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    cleaned = cleaned.replace(/www\.[^\s]+/g, '');
    // Special chars: keep letters (incl. accents), numbers, spaces
    cleaned = cleaned.replace(/[^a-záéíóúñü0-9\s]/gi, ' ');
    // Extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

async function cleanExcel() {
    const filePath = path.resolve('Pensamiento Alternativo (respuestas).xlsx');
    console.log(`Leyendo archivo: ${filePath}`);

    let workbook;
    try {
        workbook = xlsx.readFile(filePath, { cellDates: true });
    } catch (err) {
        console.error("No se pudo leer el archivo Excel:", err.message);
        return;
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Read raw data to preserve rows
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'dd/mm/yyyy hh:mm:ss' });

    if (data.length <= 1) {
        console.log("No hay datos para limpiar.");
        return;
    }

    const headerRow = data[0];
    // Fix trailing empty strings in headers
    while (headerRow.length > 0 && String(headerRow[headerRow.length - 1]).trim() === "") {
        headerRow.pop();
    }

    // Find where responses start (column '1')
    const startIdx = headerRow.indexOf('1');
    if (startIdx === -1) {
        console.log("No se encontraron columnas de respuestas.");
        return;
    }

    let maxResponses = 0;

    // Process each row
    const newData = [];
    newData.push(headerRow); // We will rebuild the header row later based on max responses

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        // Extract basic data (before responses)
        const basicData = row.slice(0, startIdx);

        // Extract responses and times
        const userResponses = [];
        for (let col = startIdx; col < headerRow.length; col += 2) {
            const respText = row[col] ? String(row[col]) : "";
            const respTime = col + 1 < row.length ? row[col + 1] : ""; // date or string

            if (respText) {
                const cleaned = cleanText(respText);
                if (cleaned) {
                    userResponses.push({
                        text: cleaned,
                        time: respTime
                    });
                }
            }
        }

        // Rebuild row
        const newRow = [...basicData];
        userResponses.forEach((r, idx) => {
            newRow.push(r.text);
            newRow.push(r.time);
        });

        if (userResponses.length > maxResponses) {
            maxResponses = userResponses.length;
        }

        newData.push(newRow);
    }

    // Rebuild header row to match maxResponses
    const newHeader = headerRow.slice(0, startIdx);
    for (let i = 1; i <= maxResponses; i++) {
        newHeader.push(i.toString());
        newHeader.push(`Tiempo ${i}`);
    }
    newData[0] = newHeader;

    // Make sure all rows have same length to avoid undefined
    for (let i = 0; i < newData.length; i++) {
        while (newData[i].length < newHeader.length) {
            newData[i].push("");
        }
        // Also truncate if somehow longer
        if (newData[i].length > newHeader.length) {
            newData[i] = newData[i].slice(0, newHeader.length);
        }
    }

    console.log(`Max número de respuestas limpio: ${maxResponses}`);

    const newWorksheet = xlsx.utils.aoa_to_sheet(newData, { cellDates: true });

    // Format dates
    const range = xlsx.utils.decode_range(newWorksheet['!ref']);
    for (let C = 0; C <= range.e.c; ++C) {
        const cellRef = xlsx.utils.encode_cell({ r: 0, c: C });
        const isTimeCol = (C === 0) || (newWorksheet[cellRef] && newWorksheet[cellRef].v && newWorksheet[cellRef].v.toString().startsWith("Tiempo"));

        if (isTimeCol) {
            for (let R = 1; R <= range.e.r; ++R) {
                const dataCell = xlsx.utils.encode_cell({ r: R, c: C });
                if (newWorksheet[dataCell]) {
                    newWorksheet[dataCell].z = 'dd/mm/yyyy hh:mm:ss';
                }
            }
        }
    }

    workbook.Sheets[sheetName] = newWorksheet;
    xlsx.writeFile(workbook, filePath);
    console.log("Archivo Excel limpiado y guardado correctamente.");
}

cleanExcel();
