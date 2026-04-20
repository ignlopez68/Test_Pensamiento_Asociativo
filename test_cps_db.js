import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Comprobando base de datos CPS (responses)...");
    
    // Primero, vamos a ver cuántas respuestas en total hay en 'cps_responses'
    const { data: countData, count, error: countErr } = await supabase.from('cps_responses').select('id, timestamp', { count: 'exact' });
    
    if (countErr) {
        console.error("Error al acceder a la tabla 'cps_responses':", countErr);
    } else {
        console.log(`Total de filas en 'cps_responses': ${count}`);
        if (count > 0 && countData) {
            // Check specific date
            const dateStr = '2026-03-24';
            const fromDate = new Date(`${dateStr}T00:00:00Z`).toISOString();
            const toDate = new Date(`${dateStr}T23:59:59Z`).toISOString();
            
            const { data: dateData } = await supabase
                .from('cps_responses')
                .select('*')
                .gte('timestamp', fromDate)
                .lte('timestamp', toDate);
                
            console.log(`Filas registradas el ${dateStr}: ${dateData ? dateData.length : 0}`);
            if (dateData && dateData.length > 0) {
                 console.log("Primera entrada registrada ese día:", JSON.stringify(dateData[0], null, 2).substring(0,200) + "...");
            }
        }
    }
}

test();
