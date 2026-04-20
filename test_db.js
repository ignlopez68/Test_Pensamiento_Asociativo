import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Testing check-user query...");
    let { data, error } = await supabase.from('users').select('id, email, nia, age, sex, degree').limit(1);
    console.log("Result:", { data, error });
}

test();
