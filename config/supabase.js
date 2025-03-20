const { createClient } = require('@supabase/supabase-js');

// Инициализация на Supabase клиент
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Липсват Supabase конфигурационни данни в .env файла');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
