const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) {
  console.warn('SUPABASE_URL is not defined');
}
if (!SUPABASE_ANON_KEY) {
  console.warn('SUPABASE_ANON_KEY is not defined');
}
if (!SUPABASE_SERVICE_KEY) {
  console.warn('SUPABASE_SERVICE_KEY is not defined (only required for writes)');
}

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

module.exports = { supabaseAnon, supabaseService };
