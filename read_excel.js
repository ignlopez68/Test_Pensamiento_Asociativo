import * as XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:\\Users\\ignlo\\Documents\\TEST CREATIVIDAD\\CPS CREATIVE PERSONALITY SCALE\\Resultados_CPS_2026-04-06.xlsx';

function testExcel() {
    console.log(`Leyendo archivo: ${filePath}...`);
    try {
        const fileData = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileData, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet);
        
        console.log(`El archivo Excel tiene ${rows.length} registros/filas.`);
        if (rows.length > 0) {
            console.log("Primera fecha en el excel:", rows[0]['Fecha']);
            console.log("Última fecha en el excel:", rows[rows.length - 1]['Fecha']);
        }
    } catch (e) {
        console.error("Error leyendo excel:", e);
    }
}

testExcel();
