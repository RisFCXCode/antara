const axios = require('axios');
const fs = require('fs');

async function run() {
  const query = 'Hotel Kuala Lumpur Malaysia "contact" -top -best -list -directory -review';
  try {
    const searchRes = await axios.post(`https://lite.duckduckgo.com/lite/`, `q=${encodeURIComponent(query)}`, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });
    fs.writeFileSync('ddg_error.html', searchRes.data);
  } catch(e) {}
}
run();
