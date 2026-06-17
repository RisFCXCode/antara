import axios from 'axios';
import * as cheerio from 'cheerio';
import { Lead } from '../db/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Helper to extract domain from URL
function getDomain(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
];

function getRandomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function generateLeads(
  location: string, 
  industry: string, 
  onProgress: (msg: string) => void
): Promise<Partial<Lead>[]> {
  const generatedLeads: Partial<Lead>[] = [];
  
  if (!API_KEY) {
    onProgress('❌ GEMINI_API_KEY not found in .env');
    return [];
  }

  try {
    const query = `${industry} ${location} Malaysia "contact" -top -best -list -directory -review`;
    onProgress(`🔍 Searching web for: "${query}"...`);
    
    // 1. Yahoo Entity Search
    const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    const searchRes = await axios.get(searchUrl, {
      headers: { 
        'User-Agent': getRandomAgent(),
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://search.yahoo.com/'
      },
      timeout: 10000
    }).catch(e => e.response || { data: "" });
    
    const $ = cheerio.load(searchRes.data);
    const rawResults: { title: string, url: string }[] = [];
    
    const blocklist = ['yellowpages', 'jobstreet', 'glassdoor', 'f6s.com', 'businesslist', 'topforeignstocks', 'zoominfo', 'famousfix', 'worldorgs', 'value.today', 'wikipedia', 'crunchbase', 'linkedin', 'facebook', 'instagram', 'twitter', 'directory', 'list', 'top', 'mudah', 'carousell', 'agoda', 'booking.com', 'tripadvisor', 'trivago', 'expedia', 'traveloka', 'hotels.com'];

    $('div.compTitle a').each((i, el) => {
      if (rawResults.length >= 8) return;
      const title = $(el).text().trim();
      let rawUrl = $(el).attr('href') || '';
      
      let url = '';
      if (rawUrl.includes('RU=')) {
         try {
            url = decodeURIComponent(rawUrl.split('RU=')[1].split('/RK=')[0]);
         } catch(e) {}
      } else if (rawUrl.startsWith('http')) {
         url = rawUrl;
      }
      url = url.toLowerCase();
      
      if (url.startsWith('http') && title.length > 3) {
        if (!url.includes('yahoo') && !blocklist.some(b => url.includes(b)) && !title.toLowerCase().includes('top') && !title.toLowerCase().includes('best') && !title.toLowerCase().includes('list') && !title.toLowerCase().includes('cheap')) {
          // Deduplicate
          if (!rawResults.some(r => r.url === url)) {
            rawResults.push({ title, url });
          }
        }
      }
    });
      
    onProgress(`✅ Found ${rawResults.length} official company domains. Beginning Intelligent Deep Crawl...`);

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    // 2. Concurrent Deep Crawling & Extraction
    const analyzeSite = async (res: { title: string, url: string }, idx: number) => {
      onProgress(`🕸️ Crawling ${res.url}...`);
      const baseDomain = getDomain(res.url);

      try {
        const siteRes = await axios.get(res.url, { 
          headers: { 'User-Agent': getRandomAgent() },
          timeout: 8000 
        });
        
        const $site = cheerio.load(siteRes.data);
        
        // Find links to contact, about, team
        const internalLinks = new Set<string>();
        $site('a').each((_, el) => {
          const href = $site(el).attr('href');
          if (href && (href.toLowerCase().includes('contact') || href.toLowerCase().includes('about') || href.toLowerCase().includes('team'))) {
            try {
               const resolvedUrl = new URL(href, res.url).href;
               if (resolvedUrl.includes(baseDomain)) internalLinks.add(resolvedUrl);
            } catch (e) {}
          }
        });

        // Fetch up to 2 secondary pages to get maximum context
        const pagesToFetch = Array.from(internalLinks).slice(0, 2);
        const pagePromises = pagesToFetch.map(link => axios.get(link, { timeout: 5000 }).catch(() => null));
        const extraPages = await Promise.all(pagePromises);
        
        // --- SECONDARY LINKEDIN SEARCH ---
        // Find the person in charge from LinkedIn via DDG
        onProgress(`🕵️‍♂️ Searching LinkedIn for decision makers at ${res.title}...`);
        let linkedinContext = "";
        try {
          const liQuery = `site:linkedin.com/in "Procurement" OR "HR" OR "Human Resources" OR "Manager" "${res.title}"`;
          const liSearchRes = await axios.get(`https://search.yahoo.com/search?p=${encodeURIComponent(liQuery)}`, {
            headers: { 
              'User-Agent': getRandomAgent(),
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://search.yahoo.com/'
            },
            timeout: 5000
          }).catch(e => e.response || { data: "" });
          const $li = cheerio.load(liSearchRes.data);
          $li('div.compTitle').each((_, row) => {
            const snippet = $li(row).text().trim().replace(/\s+/g, ' ');
            if (snippet.length > 20) linkedinContext += " [LinkedIn Match: " + snippet + "] ";
          });
        } catch (e) {
          // Ignore DDG errors, proceed with what we have
        }

        let fullContextText = $site('body').text().replace(/\s+/g, ' ');
        extraPages.forEach(p => {
           if (p && p.data) fullContextText += " " + cheerio.load(p.data)('body').text().replace(/\s+/g, ' ');
        });
        
        fullContextText += "\n\n--- EXTERNAL LINKEDIN INTELLIGENCE ---\n" + linkedinContext;
        
        // Truncate to save tokens, gemini-flash-latest can handle a lot but 15k chars is plenty
        fullContextText = fullContextText.slice(0, 15000);

        onProgress(`🧠 Analyzing data for ${res.title} via Gemini...`);

        const prompt = `
          You are an elite B2B Lead Intelligence Extractor. 
          Analyze the following website text for a company. Your goal is to extract strictly verified intelligence.
          
          Company Source URL: ${res.url}
          Search Result Title: ${res.title}
          
          Website Text:
          ${fullContextText}
          
          Extract the data into a strict JSON format with exactly these fields. Do not use markdown blocks, just raw JSON. If a piece of data is completely missing, return null for that field. Do not invent data.
          
          {
            "company_name": "The actual clean name of the company (e.g., Acme Sdn Bhd). If entirely unclear, return null.",
            "decision_maker": "Identify the name AND title of the key person in charge of HR, Procurement, Operations, or Facilities (e.g., 'John Doe - Head of Procurement'). If you find multiple, pick the most senior. If none, return null.",
            "phone": "The primary contact phone number. Format beautifully.",
            "email": "The primary professional contact email. Prefer domain-matched emails.",
            "address": "Full street address if available.",
            "city": "City of operations. If none, deduce from address.",
            "state": "State in Malaysia.",
            "postcode": "Postcode.",
            "registration_type": "Deduce from name: 'Sdn Bhd', 'Bhd', 'Enterprise', or 'Government'.",
            "ssm_number": "Look for 12 digit numbers or XXXXXX-X format. Return null if none.",
            "linkedin_url": "If a linkedin url is explicitly found in the text, return it.",
            "employee_count": "Estimate employee count based on context (e.g., hospital beds, global branches). Return an integer.",
            "procurement_confidence": "A score from 1-100 indicating how likely this company needs to buy staff uniforms (e.g. Hospitals, Hotels, Security, Banks, F&B = 80-100. Small IT tech startups = 10-30).",
            "uniform_frequency": "Estimate: 'Annually', 'Bi-annually', 'Quarterly', or 'Rarely' based on industry type."
          }
        `;

        const result = await model.generateContent(prompt);
        const textResponse = result.response.text();
        
        let parsedData: any = {};
        try {
          const jsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          parsedData = JSON.parse(jsonStr);
        } catch (e) {
          onProgress(`⚠️ Failed to parse Gemini JSON for ${res.title}`);
          return null;
        }

        // --- Data Quality Filtering & Completeness Gate ---
        
        // 1. Missing Company Name
        if (!parsedData.company_name || parsedData.company_name.toLowerCase().includes('undisclosed')) {
          onProgress(`🗑️ Discarded lead: Missing verifiable Company Name from ${res.url}`);
          return null;
        }
        
        // 2. Lack of Contact Vectors
        if (!parsedData.email && !parsedData.phone) {
          onProgress(`🗑️ Discarded ${parsedData.company_name}: No valid email or phone found.`);
          return null;
        }

        // 3. Lack of Verified Location
        if (!parsedData.city && !parsedData.address) {
          onProgress(`🗑️ Discarded ${parsedData.company_name}: Cannot verify physical location.`);
          return null;
        }

        onProgress(`✨ Successfully validated & extracted intelligence for ${parsedData.company_name}`);

        const baseScore = 30; // base logic
        const aiScore = parsedData.procurement_confidence || 30;
        
        // Combine into Lead Object
        const newLead: Partial<Lead> = {
          id: `LEAD-GEN-${Date.now()}-${idx}`,
          company_name: parsedData.company_name,
          industry: industry,
          city: parsedData.city || location,
          state: parsedData.state || 'Malaysia',
          address: parsedData.address || undefined,
          postcode: parsedData.postcode || undefined,
          phone: parsedData.phone || undefined,
          email: parsedData.email || undefined,
          decision_maker: parsedData.decision_maker || undefined,
          employee_count: parsedData.employee_count || 50,
          registration_type: parsedData.registration_type || 'Unknown',
          ssm_number: parsedData.ssm_number || undefined,
          linkedin_url: parsedData.linkedin_url || undefined,
          website: res.url,
          uniform_frequency: parsedData.uniform_frequency || 'Annually',
          estimated_order_min: parsedData.employee_count ? Math.floor(parsedData.employee_count * 1.5) : 100,
          stage: 'New',
          // Temporarily store AI score here, it will be finalized in IPC handler
          data_confidence: aiScore
        };

        return newLead;

      } catch (e: any) {
        onProgress(`⚠️ Crawler error for ${res.title}: ${e.message}`);
        return null;
      }
    };

    // Process sequentially with a delay to respect Gemini's 5 Requests Per Minute limit
    const results = [];
    for (let i = 0; i < rawResults.length; i++) {
      const r = await analyzeSite(rawResults[i], i);
      results.push(r);
      // Wait 15 seconds between requests if not the last one, to stay under 5 RPM quota
      if (i < rawResults.length - 1) {
        onProgress(`⏳ Pausing for 15s to respect AI rate limits...`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
    
    results.forEach(r => {
      if (r) generatedLeads.push(r);
    });

    onProgress(`🎉 Completed! Successfully validated ${generatedLeads.length} high-quality leads.`);
    return generatedLeads;

  } catch (error: any) {
    onProgress(`❌ Error generating leads: ${error.message}`);
    return [];
  }
}
