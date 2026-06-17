const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const query = 'Hotel Kuala Lumpur Malaysia "contact" -top -best -list -directory -review';
  try {
      const searchRes = await axios.get(`https://www.ask.com/web?q=${encodeURIComponent(query)}`, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });
      const $ = cheerio.load(searchRes.data);
      let count = 0;
      $('a.PartialSearchResults-item-title-link').each((i, el) => {
        let url = $(el).attr('href');
        console.log("Ask URL:", url);
        count++;
      });
      console.log("Total ask tags:", count);
  } catch (e) {
      console.error(e.message);
  }
}
run();
