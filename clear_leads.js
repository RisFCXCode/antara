const fs = require('fs');
const os = require('os');
const path = require('path');

const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'antara-batik', 'batik_local_db.json');
if (fs.existsSync(dbPath)) {
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  data.leads = [];
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  console.log("Leads cleared from antara-batik");
} else {
  const dbPath2 = path.join(os.homedir(), 'Library', 'Application Support', 'Antara Batik', 'batik_local_db.json');
  if (fs.existsSync(dbPath2)) {
    const data = JSON.parse(fs.readFileSync(dbPath2, 'utf8'));
    data.leads = [];
    fs.writeFileSync(dbPath2, JSON.stringify(data, null, 2));
    console.log("Leads cleared from Antara Batik");
  } else {
    console.log("DB not found in", dbPath, "or", dbPath2);
  }
}
