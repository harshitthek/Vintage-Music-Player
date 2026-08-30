function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

const DECADE_SEEDS = {
  '50s': [
    'awaara hoon mukesh', 'mera joota hai japani mukesh', 'pyar hua iqrar hua shree 420',
    'aaja re pardesi lata mangeshkar', 'chaudhvin ka chand ho rafi', 'yeh raat bheegi bheegi lata manna dey',
    'eena meena deeka kishore kumar', 'ude jab jab zulfein teri rafi asha', 'babuji dheere chalna geeta dutt',
    'ye zindagi usi ki hai lata anarkali', 'suhana safar aur yeh mausam mukesh madhumati', 'aaiye meharbaan asha howrah bridge'
  ],
  '60s': [
    'lag ja gale lata mangeshkar', 'roop tera mastana kishore kumar', 'mere sapno ki rani kishore kumar',
    'ehsaan tera hoga mujh par rafi', 'ye shaam mastani kishore kumar', 'baharon phool barsao rafi suraj',
    'aaj phir jeene ki tamanna hai lata guide', 'likhe jo khat tujhe rafi kanyadaan', 'mere mehboob tujhe meri mohabbat rafi',
    'dum maro dum asha bhosle hare rama', 'deewana hua badal rafi asha kashmir ki kali', 'gaata rahe mera dil kishore lata guide'
  ],
  '70s': [
    'pal pal dil ke paas kishore kumar blackmail', 'kabhi kabhie mere dil mein mukesh kabhi kabhie',
    'chura liya hai tumne jo dil ko asha rafi yaadon ki baaraat', 'o mere dil ke chain kishore mere jeevan saathi',
    'kya hua tera wada rafi sushma hum kisise kum naheen', 'tere bina zindagi se koi shikwa lata kishore aandhi',
    'aap ki ankhon mein kuch mehke hue kishore lata ghar', 'pyaar deewana hota hai kishore kati patang',
    'zindagi ka safar hai kaisa safar kishore safar', 'khaike paan banaraswala kishore don',
    'yeh dosti hum nahi todenge kishore manna dey sholay', 'mehbooba mehbooba rd burman sholay'
  ],
  '80s': [
    'dil cheez kya hai asha umrao jaan', 'yaad aa raha hai bappi lahiri disco dancer',
    'hawa hawai kavita mr india', 'papa kehte hain udit narayan qayamat se qayamat tak',
    'gazab ka hai din udit alka qayamat se qayamat tak', 'tum itna jo muskura rahe ho jagjit arth',
    'hothon se chhoo lo tum jagjit prem geet', 'i am a disco dancer vijay benedict disco dancer',
    'ek do teen alka tezaab', 'mere haathon mein nau nau choodiyan lata chandni',
    'aate jaate hanste gaate lata spb maine pyar kiya', 'dil deewana bin sajna ke lata spb maine pyar kiya'
  ],
  '90s': [
    'tujhe dekha to yeh jaana sanam kumar sanu lata ddlj', 'pehla nasha udit narayan sadhana jo jeeta wohi sikandar',
    'chaiyya chaiyya sukhwinder sapna dil se', 'kuch kuch hota hai udit alka',
    'chura ke dil mera kumar sanu alka main khiladi tu anari', 'dil to pagal hai lata udit',
    'bahon ke darmiyan hariharan alka khamoshi', 'sandese aate hain sonu nigam roop kumar border',
    'mera dil bhi kitna pagal hai kumar sanu alka saajan', 'do dil mil rahe hain kumar sanu pardes',
    'tip tip barsa paani udit alka mohra', 'tu cheez badi hai mast udit kavita mohra'
  ],
  '20s': [
    'kesariya arijit singh brahmastra', 'raataan lambiyan jubin nautiyal shershaah',
    'tum hi ho arijit singh aashiqui 2', 'apna bana le arijit singh bhediya',
    'heeriye jasleen royal arijit singh', 'shayad arijit singh love aaj kal',
    'maan meri jaan king', 'kahani suno kaifi khalil',
    'chaleya arijit singh shilpa rao jawan', 'o maahi arijit singh dunki',
    'satranga arijit singh animal', 'pehle bhi main vishal mishra animal'
  ]
};

async function resolveFullSong(song, forcedDecade) {
  if (!song || !song.encrypted_media_url) return null;
  try {
    const authUrl = 'https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&_format=json&_marker=0&cc=in&bitrate=160&url=' + encodeURIComponent(song.encrypted_media_url);
    const authRes = await fetch(authUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const authData = await authRes.json();
    if (!authData || !authData.auth_url) return null;

    const rawTitle = song.song || song.title || 'Unknown Title';
    const rawArtist = song.singers || (song.more_info && song.more_info.singers) || song.primary_artists || 'Unknown Artist';
    const rawAlbum = song.album || (song.more_info && song.more_info.album) || '';
    const rawImage = song.image || (song.more_info && song.more_info.image) || '';
    const duration = parseInt(song.duration || (song.more_info && song.more_info.duration) || '0', 10);
    const year = parseInt(song.year || (song.more_info && song.more_info.year) || '2000', 10);

    let decade = forcedDecade || '20s';
    if (!forcedDecade) {
      if (year >= 1950 && year < 1960) decade = '50s';
      else if (year >= 1960 && year < 1970) decade = '60s';
      else if (year >= 1970 && year < 1980) decade = '70s';
      else if (year >= 1980 && year < 1990) decade = '80s';
      else if (year >= 1990 && year < 2000) decade = '90s';
      else if (year >= 2020) decade = '20s';
    }

    return {
      id: song.id || 'saavn-' + Date.now(),
      title: cleanText(rawTitle),
      artist: cleanText(rawArtist),
      album: cleanText(rawAlbum),
      artwork: rawImage.replace('150x150', '500x500'),
      duration: duration,
      year: year,
      decade: decade,
      streamUrl: authData.auth_url
    };
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const requestedDecade = (req.query && req.query.decade) || '';
  const rawQuery = (req.query && (req.query.q || req.query.query)) || '';

  // 1. Multi-Seed Decade Feed Resolution (Returns 10-12 diverse, iconic distinct songs)
  if (requestedDecade) {
    try {
      const seeds = DECADE_SEEDS[requestedDecade] || Object.values(DECADE_SEEDS).flat();
      const searchPromises = seeds.map(async (seed) => {
        try {
          const searchUrl = 'https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=1&q=' + encodeURIComponent(seed);
          const apiRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          const data = await apiRes.json();
          return (data.results && data.results[0]) || null;
        } catch (_) {
          return null;
        }
      });

      const rawSongs = (await Promise.all(searchPromises)).filter(Boolean);
      const resolvedPromises = rawSongs.map(s => resolveFullSong(s, requestedDecade));
      const resolvedSongs = (await Promise.all(resolvedPromises)).filter(Boolean);

      // Deduplicate by clean base title
      const seenTitles = new Set();
      const uniqueSongs = [];
      for (const song of resolvedSongs) {
        const cleanKey = song.title.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^\w]/g, '').slice(0, 12);
        if (!seenTitles.has(cleanKey)) {
          seenTitles.add(cleanKey);
          uniqueSongs.push(song);
        }
      }

      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
      return res.status(200).json({ results: uniqueSongs });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (!rawQuery.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" or "decade" is required' });
  }

  // 2. Direct Search Query Resolution
  try {
    const cleanQ = rawQuery.replace(/\b(19\d\d|20\d\d)\b/g, '').replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    let searchUrl = 'https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=10&q=' + encodeURIComponent(cleanQ || rawQuery);
    let apiRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    let data = await apiRes.json();
    let results = data.results || [];

    if (!results.length) {
      const shortQ = cleanQ.split(' ').slice(0, 3).join(' ');
      if (shortQ && shortQ !== cleanQ) {
        searchUrl = 'https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=10&q=' + encodeURIComponent(shortQ);
        apiRes = await fetch(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        data = await apiRes.json();
        results = data.results || [];
      }
    }

    const limit = Math.min(Math.max(parseInt((req.query && req.query.limit) || '6', 10), 1), 10);
    const resolvedPromises = results.slice(0, limit).map(s => resolveFullSong(s));
    const resolvedSongs = (await Promise.all(resolvedPromises)).filter(Boolean);

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
    return res.status(200).json({ results: resolvedSongs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
