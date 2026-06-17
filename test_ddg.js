const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const query = "University Kuala Lumpur Malaysia contact -top -best -list -directory -review";
  try {
      const searchRes = await axios.post(`https://html.duckduckgo.com/html/`, `q=${encodeURIComponent(query)}`, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });
      console.log(searchRes.data.substring(0, 500));
      const $ = cheerio.load(searchRes.data);
      let count = 0;
      $('a').each((i, el) => {
        let url = $(el).attr('href');
        console.log("Found raw URL:", url);
        count++;
      });
      console.log("Total a tags:", count);
  } catch (e) {
      console.error(e.message);
  }
}
run();
