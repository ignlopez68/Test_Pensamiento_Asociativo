import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const targetNia = '929313';
    
    // Get user
    const { data: users, error: userError } = await supabase.from('users').select('*').eq('nia', targetNia);
    if (!users || users.length === 0) {
        console.log("No se encontró el usuario con NIA:", targetNia);
        return;
    }
    const user = users[0];
    
    // Get their analysis result
    const { data: results, error: resError } = await supabase.from('analysis_results').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(1);
    if (!results || results.length === 0) {
        console.log("No se encontraron resultados de análisis para el usuario", targetNia);
        return;
    }
    const userResult = results[0];
    const testDate = userResult.date;
    
    // Let's get the maxes and mean for that date
    const { data: allResults, error: allErr } = await supabase.from('analysis_results').select('*').eq('date', testDate);
    
    let maxFluidez = 0, maxOriginalidad = 0, maxOriginalidadRel = 0, maxFlexibilidad = 0, maxElaboracion = 0;
    let totalFluidez = 0;
    
    for(const r of allResults) {
        totalFluidez += r.fluidez;
        if(r.fluidez > maxFluidez) maxFluidez = r.fluidez;
        if(r.originalidad > maxOriginalidad) maxOriginalidad = r.originalidad;
        if(r.originalidad_relativa > maxOriginalidadRel) maxOriginalidadRel = r.originalidad_relativa;
        if(r.flexibilidad > maxFlexibilidad) maxFlexibilidad = r.flexibilidad;
        if(r.elaboracion > maxElaboracion) maxElaboracion = r.elaboracion;
    }
    
    const meanResponses = allResults.length > 0 ? (totalFluidez / allResults.length) : 0;
    
    const u = userResult;
    const tpoFluidez = maxFluidez > 0 ? (u.fluidez / maxFluidez).toFixed(2) : 0;
    const tpoOriginalidad = maxOriginalidad > 0 ? (u.originalidad / maxOriginalidad).toFixed(2) : 0;
    const tpoOriginalidadRel = maxOriginalidadRel > 0 ? (u.originalidad_relativa / maxOriginalidadRel).toFixed(2) : 0;
    const tpoFlexibilidad = maxFlexibilidad > 0 ? (u.flexibilidad / maxFlexibilidad).toFixed(2) : 0;
    const tpoElaboracion = maxElaboracion > 0 ? (u.elaboracion / maxElaboracion).toFixed(2) : 0;

    const text = `Hola,\n\nEstos son los resultados de tu test de creatividad realizado el ${testDate}:\n\n` +
        `Número total de tus respuestas (Fluidez): ${u.fluidez}\n` +
        `Número de respuestas promedio del grupo: ${meanResponses.toFixed(2)}\n\n` +
        `Evaluación de tus Indicadores (valor / tanto por uno respecto al máximo del grupo):\n` +
        `- Fluidez: ${u.fluidez} / ${tpoFluidez}\n` +
        `- Originalidad (Absoluta): ${u.originalidad} / ${tpoOriginalidad}\n` +
        `- Originalidad (Relativa): ${u.originalidad_relativa.toFixed(2)} / ${tpoOriginalidadRel}\n` +
        `- Flexibilidad: ${u.flexibilidad} / ${tpoFlexibilidad}\n` +
        `- Elaboración: ${u.elaboracion.toFixed(2)} / ${tpoElaboracion}\n\n` +
        `Originalidad absoluta es el número de respuestas únicas en tu grupo para la fecha del test. Originalidad relativa es el sumatorio de las frecuencias de originalidad de cada respuesta.\n` +
        `Flexibilidad es el número de categorías distintas que cubren tus respuestas.\n` +
        `Elaboración es el promedio de palabras por idea.\n\n` +
        `¡Gracias por participar!`;
        
    console.log(text);
}

run();
