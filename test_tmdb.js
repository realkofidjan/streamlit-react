require('dotenv').config();
const axios = require('axios');

async function test() {
  const query = "The Fresh Prince of Bel Air";
  const year = 1990;
  const api_key = process.env.VITE_TMDB_API_KEY;
  console.log("Key length:", api_key ? api_key.length : 0);
  
  const res = await axios.get(`https://api.themoviedb.org/3/search/tv`, {
    params: { query, api_key, language: 'en-US' }
  });
  
  console.log("Total results:", res.data.results.length);
  const best = res.data.results.find(r => (r.first_air_date || '').startsWith(String(year)));
  console.log("Best match:", best ? best.name : 'None found');
  
  // also what if just the first
  if (res.data.results[0]) console.log("First match year:", res.data.results[0].first_air_date)
}
test();
