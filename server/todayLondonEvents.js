const LONDON_TIME_ZONE = 'Europe/London';
const IAN_VISITS_URL = 'https://www.ianvisits.co.uk/calendar/';
const CITY_OF_LONDON_URL = 'https://www.thecityofldn.com/things-to-see-and-do/whats-on/';
const TIMEOUT_LONDON_URL = 'https://www.timeout.com/london/things-to-do';
const ATLAS_OBSCURA_LONDON_URL = 'https://www.atlasobscura.com/things-to-do/london-england';
const FEVER_LONDON_URL = 'https://feverup.com/en/london';
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map();

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const EVENT_TYPES = [
  ['book', /\b(book|author|reading|literary|poetry|novel|writer)\b/i],
  ['music', /concert|music|jazz|dj|band|club|karaoke|dance|gig/i],
  ['museum', /\b(museum|gallery|exhibit|exhibition|art|arts|archive|archives)\b/i],
  ['outdoors', /outdoor|park|garden|walk|run|bike|hike|market|river|tour/i],
  ['tech', /\b(tech|startup|developer|ai|software|data|cyber|founder)\b/i],
  ['political', /politic|policy|civic|government|parliament|public affairs/i],
  ['sports', /sport|football|tennis|cricket|rugby|game/i],
];

const TYPE_IMAGES = {
  music: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80',
  museum: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  outdoors: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
  tech: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  political: 'https://images.unsplash.com/photo-1540783797630-447cd0f3eb3d?auto=format&fit=crop&w=1200&q=80',
  sports: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  book: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80',
  other: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80',
};

const FALLBACK_IMAGES = new Set(Object.values(TYPE_IMAGES));

const text = (value) => (typeof value === 'string' ? decodeEntities(value).trim() : '');

const decodeEntities = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([a-f0-9]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)))
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&ndash;/g, '-')
  .replace(/&mdash;/g, '-')
  .replace(/&rsquo;/g, "'")
  .replace(/&lsquo;/g, "'")
  .replace(/&rdquo;/g, '"')
  .replace(/&ldquo;/g, '"')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const stripTags = (value = '') => decodeEntities(String(value).replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const isHttpUrl = (value) => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const absoluteUrl = (value, baseUrl) => {
  const raw = decodeEntities(value ?? '').trim();
  if (!raw) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
};

const inferType = (...values) => {
  const haystack = values.map(text).filter(Boolean).join(' ');
  for (const [type, pattern] of EVENT_TYPES) {
    if (pattern.test(haystack)) return type;
  }
  return 'other';
};

const imageForType = (type) => TYPE_IMAGES[type] ?? TYPE_IMAGES.other;

const hasScrapedImage = (event) => isHttpUrl(event?.image) && !FALLBACK_IMAGES.has(event.image);

const fetchText = async (url, timeout = 9000) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/json',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

const getZonedParts = (date, timeZone = LONDON_TIME_ZONE) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const values = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return values;
};

const zonedTimeToUtc = ({ year, month, day, hour = 0, minute = 0, second = 0 }) => {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = new Date(desiredAsUtc);

  for (let index = 0; index < 3; index += 1) {
    const actual = getZonedParts(guess);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess = new Date(guess.getTime() + desiredAsUtc - actualAsUtc);
  }

  return guess;
};

const addDays = ({ year, month, day }, amount) => {
  const next = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
};

const formatDate = ({ year, month, day }) => (
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const parseDateLabel = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
};

const getTodayWindow = (dateLabel) => {
  const realNow = new Date();
  const realToday = getZonedParts(realNow);
  const selected = parseDateLabel(dateLabel) ?? realToday;
  const selectedLabel = formatDate(selected);
  const realTodayLabel = formatDate(realToday);
  const now = selectedLabel === realTodayLabel ? realNow : zonedTimeToUtc({ ...selected, hour: 0 });
  const tomorrow = addDays(selected, 1);

  return {
    now,
    end: zonedTimeToUtc({ ...tomorrow, hour: 2 }),
    today: selected,
    tomorrow,
    todayLabel: selectedLabel,
    tomorrowLabel: formatDate(tomorrow),
  };
};

const formatTime = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'See details';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
};

const extractMetaContent = (html, key) => {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i'))?.[0];
  return decodeEntities(tag?.match(/content=["']([^"']+)["']/i)?.[1] ?? '');
};

const fetchOpenGraphImage = async (url) => {
  if (!isHttpUrl(url)) return null;
  try {
    const html = await fetchText(url, 4500);
    const rawImage = extractMetaContent(html.slice(0, 160_000), 'og:image')
      || extractMetaContent(html.slice(0, 160_000), 'twitter:image');
    return absoluteUrl(rawImage, url);
  } catch {
    return null;
  }
};

const parseLondonTime = (dateLabel, value) => {
  const date = parseDateLabel(dateLabel);
  if (!date) return null;
  const normalized = text(value).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  const match = normalized.match(/(?:starts at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const period = match[3].toLowerCase();
  if (period === 'pm' && hour < 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return zonedTimeToUtc({ ...date, hour, minute }).toISOString();
};

const parseLondonIsoDateTime = (value) => {
  const raw = text(value);
  if (!raw) return null;
  const hasOffset = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const parsed = new Date(hasOffset ? raw : `${raw}+01:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const priceRank = (event) => /\bfree\b/i.test([event.time, event.description].join(' ')) ? 0 : 1;
const recurringRank = (event) => /\b(various dates|ongoing|regular|daily|weekly|permanent)\b/i.test([event.time, event.description].join(' ')) ? 1 : 0;

const normalizeEvent = (event) => ({
  title: text(event.title) || 'Untitled event',
  type: event.type || inferType(event.title, event.description, event.venue),
  venue: text(event.venue) || 'London listing',
  address: text(event.address),
  date: text(event.date),
  time: text(event.time) || 'See details',
  description: text(event.description).slice(0, 260),
  url: isHttpUrl(event.url) ? event.url : null,
  image: isHttpUrl(event.image) ? event.image : imageForType(event.type || 'other'),
  source: text(event.source) || 'London source',
  startsAt: event.startsAt || null,
});

const parseIanVisitsEvents = (html, window) => {
  const blocks = [...html.matchAll(/<div[^>]+class=["'][^"']*\bevent_wrapper\b[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]+class=["'][^"']*\bevent_wrapper\b|<h2[^>]+class=["'][^"']*\bcalendarh2\b|<\/div>\s*<\/article>)/gi)];
  const events = [];

  for (const [block] of blocks) {
    const titleAnchor = block.match(/<h3[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!titleAnchor) continue;

    const url = absoluteUrl(titleAnchor[1], IAN_VISITS_URL);
    const title = stripTags(titleAnchor[2]);
    const image = absoluteUrl(
      block.match(/<img[^>]+data-lazy-src=["']([^"']+)["']/i)?.[1]
        ?? block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i)?.[1],
      IAN_VISITS_URL,
    );
    const time = stripTags(block.match(/<div[^>]+class=["'][^"']*\bevent_time\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
      || 'See details';
    const price = stripTags(block.match(/<div[^>]+class=["'][^"']*\bevent_price\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    const venue = stripTags(block.match(/<div[^>]+class=["'][^"']*\bevent_location\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    const description = stripTags(block.match(/<div[^>]+class=["'][^"']*\bevent_exerpt\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '').slice(0, 260);
    const start = text(block.match(/\bitemprop=["']startDate["'][^>]+content=["']([^"']+)["']/i)?.[1]);
    const type = inferType(title, description, venue);

    events.push(normalizeEvent({
      title,
      type,
      venue: venue || 'IanVisits pick',
      address: venue,
      date: window.todayLabel,
      time: [time, price].filter(Boolean).join(', '),
      description: [description, price].filter(Boolean).join(' · '),
      url,
      image,
      source: 'IanVisits',
      startsAt: parseLondonIsoDateTime(start) ?? parseLondonTime(window.todayLabel, time),
    }));
  }

  return events;
};

const parseJsonLdEvents = (html, baseUrl, source, window) => {
  const events = [];
  const collect = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (value['@type'] === 'Event' || value.type === 'Event') events.push(value);
    if (Array.isArray(value['@graph'])) value['@graph'].forEach(collect);
    if (Array.isArray(value.itemListElement)) value.itemListElement.forEach((item) => collect(item.item ?? item));
  };

  for (const [, rawJson] of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      collect(JSON.parse(decodeEntities(rawJson)));
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  return events.map((event) => {
    const title = text(event.name ?? event.headline) || 'Untitled event';
    const description = stripTags(event.description).slice(0, 260);
    const location = Array.isArray(event.location) ? event.location[0] : event.location;
    const image = Array.isArray(event.image) ? event.image.find(isHttpUrl) : event.image;
    const start = event.startDate ?? null;
    const type = inferType(title, description, location?.name);

    return normalizeEvent({
      title,
      type,
      venue: text(location?.name) || `${source} listing`,
      address: [location?.address?.streetAddress, location?.address?.addressLocality].map(text).filter(Boolean).join(', '),
      date: start ? formatDate(getZonedParts(new Date(start))) : window.todayLabel,
      time: start ? formatTime(start) : 'See details',
      description,
      url: absoluteUrl(event.url ?? event['@id'], baseUrl) ?? baseUrl,
      image: absoluteUrl(image, baseUrl),
      source,
      startsAt: start ? new Date(start).toISOString() : null,
    });
  });
};

const parseArticleCards = (html, baseUrl, source, window) => {
  const cards = [...html.matchAll(/<article[\s\S]*?<\/article>|<li[\s\S]*?<\/li>/gi)].slice(0, 80);
  const events = [];
  const genericLabels = new Set([
    'search our event calendar',
    'attractions',
    'experience',
    'family',
    'food drink',
    'free',
    'health wellbeing',
    'history',
    'music',
    'nightlife',
    'sport fitness',
    'tours walks',
  ]);

  for (const [card] of cards) {
    const anchor = card.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const title = stripTags(card.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i)?.[1] ?? anchor?.[2] ?? '');
    if (!title || title.length < 4) continue;
    if (genericLabels.has(title.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, ' ').trim())) continue;

    const url = absoluteUrl(anchor?.[1], baseUrl);
    const image = absoluteUrl(card.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i)?.[1], baseUrl);
    const description = stripTags(card).replace(title, '').slice(0, 260);
    if (description.length < 35 && source !== 'Atlas Obscura') continue;
    const type = inferType(title, description);

    events.push(normalizeEvent({
      title,
      type,
      venue: `${source} pick`,
      address: 'London',
      date: window.todayLabel,
      time: /\bfree\b/i.test(description) ? 'Free' : 'See details',
      description,
      url,
      image,
      source,
      startsAt: null,
    }));
  }

  return events;
};

const runSource = async (source, fetcher, timeoutMs = 9000) => {
  try {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    const events = await Promise.race([fetcher(), timeout]);
    return { source, status: 'ok', events };
  } catch (error) {
    return { source, status: error instanceof Error ? error.message : 'error', events: [] };
  }
};

const dedupeEvents = (events) => {
  const byKey = new Map();
  const normalize = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  for (const event of events.map(normalizeEvent)) {
    const key = `${normalize(event.title)}|${event.date}`;
    if (!byKey.has(key)) {
      byKey.set(key, event);
      continue;
    }
    const current = byKey.get(key);
    byKey.set(key, {
      ...current,
      ...event,
      source: Array.from(new Set([current.source, event.source].filter(Boolean))).join(' + '),
      image: hasScrapedImage(current) ? current.image : event.image,
      description: current.description.length > event.description.length ? current.description : event.description,
      startsAt: current.startsAt || event.startsAt,
    });
  }

  return Array.from(byKey.values());
};

const sortEvents = (events) => events.sort((a, b) => {
  const freeRank = priceRank(a) - priceRank(b);
  if (freeRank !== 0) return freeRank;

  const oneOffRank = recurringRank(a) - recurringRank(b);
  if (oneOffRank !== 0) return oneOffRank;

  const imageRank = Number(hasScrapedImage(b)) - Number(hasScrapedImage(a));
  if (imageRank !== 0) return imageRank;

  const left = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  const right = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  return left - right;
});

const isInWindow = (event, window) => {
  if (!event.startsAt) return event.date === window.todayLabel;
  const start = new Date(event.startsAt);
  return !Number.isNaN(start.getTime()) && start >= window.now && start <= window.end;
};

export const getTodayLondonEvents = async ({ date, phase = 'full' } = {}) => {
  const now = Date.now();
  const dateLabel = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const normalizedPhase = phase === 'fast' ? 'fast' : 'full';
  const cacheKey = `london:${dateLabel ?? 'today'}:${normalizedPhase}`;
  const cached = cache.get(cacheKey);
  if (cached && now - cached.createdAt < CACHE_TTL_MS) {
    return {
      ...cached.payload,
      meta: {
        ...cached.payload.meta,
        cached: true,
        cacheAgeSeconds: Math.round((now - cached.createdAt) / 1000),
      },
    };
  }

  const window = getTodayWindow(dateLabel);
  const sources = [
    {
      source: 'IanVisits',
      phase: 'fast',
      fetcher: async () => parseIanVisitsEvents(await fetchText(IAN_VISITS_URL), window),
    },
    {
      source: 'City of London',
      phase: 'fast',
      fetcher: async () => [
        ...parseJsonLdEvents(await fetchText(CITY_OF_LONDON_URL), CITY_OF_LONDON_URL, 'City of London', window),
        ...parseArticleCards(await fetchText(CITY_OF_LONDON_URL), CITY_OF_LONDON_URL, 'City of London', window),
      ],
    },
    {
      source: 'Time Out London',
      phase: 'full',
      fetcher: async () => parseArticleCards(await fetchText(TIMEOUT_LONDON_URL), TIMEOUT_LONDON_URL, 'Time Out London', window),
    },
    {
      source: 'Atlas Obscura',
      phase: 'full',
      fetcher: async () => parseArticleCards(await fetchText(ATLAS_OBSCURA_LONDON_URL), ATLAS_OBSCURA_LONDON_URL, 'Atlas Obscura', window),
    },
    {
      source: 'Fever',
      phase: 'full',
      fetcher: async () => parseArticleCards(await fetchText(FEVER_LONDON_URL), FEVER_LONDON_URL, 'Fever', window),
    },
  ].filter((source) => normalizedPhase === 'full' || source.phase === 'fast');

  const results = await Promise.all(sources.map((source) => runSource(source.source, source.fetcher, normalizedPhase === 'fast' ? 7000 : 11_000)));
  const filteredResults = results.map((source) => ({
    ...source,
    events: source.events.filter((event) => isInWindow(event, window)),
  }));
  const events = sortEvents(dedupeEvents(filteredResults.flatMap((source) => source.events))).slice(0, 80);

  const payload = {
    events,
    meta: {
      count: events.length,
      city: 'London',
      timeZone: LONDON_TIME_ZONE,
      rangeStart: window.now.toISOString(),
      rangeEnd: window.end.toISOString(),
      today: window.todayLabel,
      cached: false,
      phase: normalizedPhase,
      sourceStatus: filteredResults.map(({ source, status, events: sourceEvents }) => ({
        source,
        status,
        count: sourceEvents.length,
      })),
    },
  };

  cache.set(cacheKey, { createdAt: now, payload });
  return payload;
};
