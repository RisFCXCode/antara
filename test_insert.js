require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
  const newInvoice = {
      id: "REC-12345",
      customer_name: "Test",
      customer_phone: "123",
      status: "paid",
      subtotal: 400,
      discount_type: "none",
      discount_value: 0,
      discount_amount: 0,
      total: 400,
      items: [{fabric_type: 'Dubai Cotton', quantity_meters: 10, price_per_meter: 40, total: 400}],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('invoices').insert(newInvoice);
  console.log("Error:", error);
})();
