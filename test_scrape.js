const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const query = "Corporate companies in Kuala Lumpur Malaysia";
    console.log(`Searching for: ${query}`);
    
    const res = await axios.post(`https://lite.duckduckgo.com/lite/`, `q=${encodeURIComponent(query)}`, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    
    const $ = cheerio.load(res.data);
    const results = [];
    
    $('.result-title').each((i, el) => {
      const title = $(el).text().trim();
      const url = $(el).attr('href')?.trim();
      if (title && url) results.push({ title, url });
    });
    
      $('a').each((i, el) => {
        const title = $(el).text().trim();
        const url = $(el).attr('href');
        if (url && url.startsWith('http') && !url.includes('duckduckgo')) {
           console.log(`Title: "${title}" | URL: ${url}`);
        }
      });
    console.log(results);
    
  } catch (err) {
    console.error(err.message);
  }
}

test();
