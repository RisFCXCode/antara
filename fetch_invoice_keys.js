require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
  const { data } = await supabase.from('invoices').select('*').limit(1);
  console.log(Object.keys(data[0]));
})();
