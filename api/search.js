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

const DECADE_QUERIES = {
  '50s': ['awaara hoon mukesh', 'mera joota hai japani', 'pyar hua iqrar hua', 'aaja re pardesi lata', 'chaudhvin ka chand rafi', 'yeh raat bheegi bheegi lata'],
  '60s': ['lag ja gale lata mangeshkar', 'roop tera mastana kishore', 'mere sapno ki rani kishore', 'ehsaan tera hoga mujh par rafi', 'ye shaam mastani kishore', 'baharon phool barsao rafi'],
  '70s': ['pal pal dil ke paas kishore', 'kabhi kabhie mere dil mein mukesh', 'chura liya hai tumne', 'dum maro dum asha', 'kya hua tera wada rafi', 'o mere dil ke chain kishore'],
  '80s': ['dil cheez kya hai asha', 'yaad aa raha hai bappi', 'hawa hawai kavita', 'gazab ka hai din udit', 'papa kehte hain udit', 'tum itna jo muskura rahe ho jagjit'],
  '90s': ['tujhe dekha to kumar sanu', 'pehla nasha udit', 'chaiyya chaiyya sukhwinder', 'kuch kuch hota hai udit', 'chura ke dil mera kumar sanu', 'dil to pagal hai lata udit'],
  '20s': ['kesariya arijit singh', 'raataan lambiyan jubin', 'tum hi ho arijit singh', 'shayad arijit singh', 'channa mereya arijit', 'heeriye arijit singh jasleen']
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
  let rawQuery = (req.query && (req.query.q || req.query.query)) || '';

  if (requestedDecade) {
    const list = DECADE_QUERIES[requestedDecade] || Object.values(DECADE_QUERIES).flat();
    rawQuery = list[Math.floor(Math.random() * list.length)];
  }

  if (!rawQuery.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" or "decade" is required' });
  }

  try {
    const cleanQ = rawQuery.replace(/\b(19\d\d|20\d\d)\b/g, '').replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    let searchUrl = 'https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=10&q=' + encodeURIComponent(cleanQ || rawQuery);
    let apiRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    let data = await apiRes.json();
    let results = data.results || [];

    // If no results, retry with first 3 words
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

    const limit = Math.min(Math.max(parseInt((req.query && req.query.limit) || (requestedDecade ? '8' : '6'), 10), 1), 10);
    const resolvedPromises = results.slice(0, limit).map(s => resolveFullSong(s, requestedDecade || undefined));
    const resolvedSongs = (await Promise.all(resolvedPromises)).filter(Boolean);

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
    return res.status(200).json({ results: resolvedSongs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
