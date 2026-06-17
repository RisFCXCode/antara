require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(1);
  if (error) console.error(error);
  else console.log(JSON.stringify(data[0], null, 2));
})();
