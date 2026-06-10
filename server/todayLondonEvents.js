const LONDON_TIME_ZONE = 'Europe/London';
const IAN_VISITS_URL = 'https://www.ianvisits.co.uk/calendar/';
const CITY_OF_LONDON_URL = 'https://www.thecityofldn.com/things-to-see-and-do/whats-on/';
const TIMEOUT_LONDON_URL = 'https://www.timeout.com/london/things-to-do';
const ATLAS_OBSCURA_LONDON_URL = 'https://www.atlasobscura.com/things-to-do/london-england';
const FEVER_LONDON_URL = 'https://feverup.com/en/london';
const LONDONIST_FEED_URL = 'https://londonist.com/feed';
const LONDON_THE_INSIDE_URL = 'https://londontheinside.com/whatson/';
const BARBICAN_URL = 'https://www.barbican.org.uk/whats-on';
const SONGKICK_LONDON_URL = 'https://www.songkick.com/metro-areas/24426-uk-london';
const SECRET_LDN_URL = 'https://secretldn.com/things-to-do/';
const SOMERSET_HOUSE_URL = 'https://www.somersethouse.org.uk/whats-on';
const BFI_URL = 'https://whatson.bfi.org.uk/Online/default.asp';
const EVENTBRITE_FREE_LONDON_URL = 'https://www.eventbrite.co.uk/d/united-kingdom--london/free--events/';
const ENTS24_LONDON_URL = 'https://www.ents24.com/whatson/london';
const INTELLIGENCE_SQUARED_URL = 'https://www.intelligencesquared.com/attend/';
const MEETUP_LONDON_URL = 'https://www.meetup.com/find/?location=gb--17--London&source=EVENTS';
const THE_NUDGE_URL = 'https://thenudge.com/london-things-to-do/';
const ROYAL_INSTITUTION_URL = 'https://www.rigb.org/whats-on';
const LONDON_MUSEUM_URL = 'https://www.londonmuseum.org.uk/whats-on/?date_preference=custom&from_date=&tag=&person=&organisation=';
const GRESHAM_URL = 'https://www.gresham.ac.uk/whats-on?see-all';
const RA_GRAPHQL_URL = 'https://ra.co/graphql';
const RA_LONDON_AREA_ID = 13;
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

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
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

const stripTags = (value = '') => decodeEntities(String(value)
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' '))
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

const srcsetWidth = (descriptor = '') => {
  const width = descriptor.match(/(\d+)w\b/i)?.[1];
  if (width) return Number(width);
  const density = descriptor.match(/([\d.]+)x\b/i)?.[1];
  return density ? Number(density) * 1000 : 0;
};

const bestImageFromSrcset = (value, baseUrl) => {
  const raw = decodeEntities(value ?? '').trim();
  if (!raw) return null;
  const candidates = raw
    .split(',')
    .map((candidate) => {
      const [url, descriptor = ''] = candidate.trim().split(/\s+/, 2);
      return {
        url: absoluteUrl(url, baseUrl),
        width: srcsetWidth(descriptor),
      };
    })
    .filter((candidate) => isHttpUrl(candidate.url));

  return candidates.sort((a, b) => b.width - a.width)[0]?.url ?? null;
};

const useOriginalWordpressImage = (value) => {
  if (!isHttpUrl(value)) return value;
  return value.replace(/-\d+x\d+(\.(?:jpe?g|png|webp|gif))(?:\?.*)?$/i, '$1');
};

const bestImageFromHtml = (html, baseUrl) => {
  const imageTag = html.match(/<img\b[^>]*>/i)?.[0] ?? '';
  if (!imageTag) return null;

  const image = bestImageFromSrcset(
    imageTag.match(/\bdata-lazy-srcset=["']([^"']+)["']/i)?.[1]
      ?? imageTag.match(/\bdata-srcset=["']([^"']+)["']/i)?.[1]
      ?? imageTag.match(/\bsrcset=["']([^"']+)["']/i)?.[1],
    baseUrl,
  ) ?? absoluteUrl(
    imageTag.match(/\bdata-lazy-src=["']([^"']+)["']/i)?.[1]
      ?? imageTag.match(/\bdata-src=["']([^"']+)["']/i)?.[1]
      ?? imageTag.match(/\bsrc=["']([^"']+)["']/i)?.[1],
    baseUrl,
  );

  return useOriginalWordpressImage(image);
};

const bestFeaturedImageFromHtml = (html, baseUrl) => {
  const imageTag = html.match(/<img\b(?=[^>]*\b(?:wp-post-image|attachment-post-thumbnail)\b)[^>]*>/i)?.[0] ?? '';
  return imageTag ? bestImageFromHtml(imageTag, baseUrl) : null;
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

const fetchOpenGraphImage = async (url, timeout = 4500) => {
  if (!isHttpUrl(url)) return null;
  try {
    const html = await fetchText(url, timeout);
    const rawImage = extractMetaContent(html.slice(0, 160_000), 'og:image')
      || extractMetaContent(html.slice(0, 160_000), 'twitter:image');
    return useOriginalWordpressImage(absoluteUrl(rawImage, url))
      || bestFeaturedImageFromHtml(html.slice(0, 260_000), url);
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

const weekdayName = ({ year, month, day }) => new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TIME_ZONE,
  weekday: 'long',
}).format(zonedTimeToUtc({ year, month, day, hour: 12 })).toLowerCase();

const dateFromDayMonth = (day, monthName, fallbackYear) => {
  const month = MONTHS[String(monthName || '').slice(0, 3).toLowerCase()];
  if (!month || !day) return null;
  return formatDate({ year: fallbackYear, month, day: Number(day) });
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
const childAudienceRank = (event) => /\b(children|child|kids|kid|family|families|toddler|toddlers|preschool|youth|teen|teens|storytime|story time|all ages|all-ages|babies|baby)\b/i
  .test([event.title, event.type, event.description, event.venue, event.source].join(' ')) ? 1 : 0;
const evergreenGuideRank = (event) => {
  const haystack = [event.title, event.time, event.description, event.venue, event.source].join(' ');
  if (!/\b(Time Out London|Fever|Secret London|The Nudge|Atlas Obscura)\b/i.test(event.source)) return 0;
  return /\b(bucket list|best things to do|things to do in \w+|best of|best \w+|where to watch|on a budget|bike rides|free museums|guide|guides|events in \w+|what'?s on this \w+|attractions|ideas)\b/i.test(haystack)
    ? 1
    : 0;
};
const SOURCE_PRIORITY = [
  'IanVisits',
  'Londonist',
  'London The Inside',
  'Songkick',
  'Resident Advisor',
  'Secret London',
  'Barbican',
  'BFI',
  'City of London',
  'Time Out London',
  'The Nudge',
  'Somerset House',
  'Atlas Obscura',
  'Fever',
  'Ents24',
  'Intelligence Squared',
  'Meetup London',
  'Eventbrite Free London',
];
const SOURCE_PRIORITY_MAP = new Map(SOURCE_PRIORITY.map((source, index) => [source, index]));
const sourceRank = (event) => {
  const sources = text(event.source).split(/\s+\+\s+/).filter(Boolean);
  const ranks = sources.map((source) => SOURCE_PRIORITY_MAP.get(source) ?? SOURCE_PRIORITY.length);
  return ranks.length ? Math.min(...ranks) : SOURCE_PRIORITY.length;
};
const sourceKey = (event) => text(event.source).split(/\s+\+\s+/).filter(Boolean)[0] || 'Other';

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
    const image = bestImageFromHtml(block, IAN_VISITS_URL);
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

const enrichIanVisitsImages = async (events, { limit = 12, timeout = 2800 } = {}) => {
  const missingImageEvents = events
    .filter((event) => event.source === 'IanVisits' && !hasScrapedImage(event) && isHttpUrl(event.url))
    .slice(0, limit);

  if (!missingImageEvents.length) return events;

  const imageByUrl = new Map(await Promise.all(missingImageEvents.map(async (event) => ([
    event.url,
    await fetchOpenGraphImage(event.url, timeout),
  ]))));

  return events.map((event) => {
    const image = imageByUrl.get(event.url);
    return image ? { ...event, image } : event;
  });
};

const fetchRaLondonEvents = async (window) => {
  const query = 'query GET_EVENTS($filters: FilterInputDtoInput, $pageSize: Int) { eventListings(filters: $filters, pageSize: $pageSize, page: 1, sort: { attending: { priority: 1, order: DESCENDING } }) { data { id listingDate event { id title attending date contentUrl flyerFront images { id filename alt type crop } venue { id name contentUrl live } } } } }';
  const variables = {
    filters: {
      areas: { eq: RA_LONDON_AREA_ID },
      listingDate: { gte: window.todayLabel, lte: window.tomorrowLabel },
      listingPosition: { eq: 1 },
    },
    pageSize: 18,
  };

  const response = await fetch(RA_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(6500),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const listings = payload?.data?.eventListings?.data;
  if (!Array.isArray(listings)) return [];

  return listings.map((listing) => {
    const event = listing?.event ?? {};
    const image = Array.isArray(event.images)
      ? event.images.find((candidate) => candidate?.type === 'FLYERFRONT' && isHttpUrl(candidate.filename))?.filename
        ?? event.images.find((candidate) => isHttpUrl(candidate?.filename))?.filename
      : null;
    const dateLabel = formatDate(getZonedParts(new Date(listing.listingDate ?? event.date)));
    const venue = text(event.venue?.name) || 'London nightlife';
    const attending = Number(event.attending);

    return normalizeEvent({
      title: event.title,
      type: 'music',
      venue,
      address: venue,
      date: dateLabel,
      time: 'Tonight',
      description: [
        venue,
        Number.isFinite(attending) && attending > 0 ? `${attending} interested on RA` : '',
      ].filter(Boolean).join(' · '),
      url: absoluteUrl(event.contentUrl, 'https://ra.co') ?? absoluteUrl(`/events/${event.id}`, 'https://ra.co'),
      image,
      source: 'Resident Advisor',
      startsAt: null,
    });
  }).filter((event) => event.date === window.todayLabel);
};

const parseRssItems = (xml) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, item]) => ({
  title: stripTags(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
  link: stripTags(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? ''),
  content: decodeEntities(item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i)?.[1] ?? ''),
  image: absoluteUrl(item.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1], LONDONIST_FEED_URL),
}));

const londonistSectionDate = (heading, window) => {
  const normalized = text(heading).toLowerCase();
  const todayWeekday = weekdayName(window.today);

  if (/all week|ongoing|today/.test(normalized)) return window.todayLabel;
  if (/all weekend/.test(normalized)) {
    return /saturday|sunday/.test(todayWeekday) ? window.todayLabel : null;
  }

  const weekdayMatch = normalized.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b(?:\s+(\d{1,2})\s+([a-z]+))?/i);
  if (!weekdayMatch) return null;
  if (weekdayMatch[2]) return dateFromDayMonth(weekdayMatch[2], weekdayMatch[3], window.today.year);
  return WEEKDAYS[weekdayMatch[1]] === WEEKDAYS[todayWeekday] ? window.todayLabel : null;
};

const compareDateLabels = (left, right) => left.localeCompare(right);

const londonistTimeApplies = (time, sectionDate, window) => {
  const normalized = text(time).toLowerCase();
  if (!normalized || !sectionDate) return true;
  const year = window.today.year;

  const twoMonthRange = normalized.match(/(\d{1,2})\s+([a-z]+)\s*-\s*(\d{1,2})\s+([a-z]+)/i);
  if (twoMonthRange) {
    const start = dateFromDayMonth(twoMonthRange[1], twoMonthRange[2], year);
    const end = dateFromDayMonth(twoMonthRange[3], twoMonthRange[4], year);
    return Boolean(start && end && compareDateLabels(window.todayLabel, start) >= 0 && compareDateLabels(window.todayLabel, end) <= 0);
  }

  const sameMonthRange = normalized.match(/(\d{1,2})-(\d{1,2})\s+([a-z]+)/i);
  if (sameMonthRange) {
    const start = dateFromDayMonth(sameMonthRange[1], sameMonthRange[3], year);
    const end = dateFromDayMonth(sameMonthRange[2], sameMonthRange[3], year);
    return Boolean(start && end && compareDateLabels(window.todayLabel, start) >= 0 && compareDateLabels(window.todayLabel, end) <= 0);
  }

  const untilMatch = normalized.match(/until\s+(\d{1,2})\s+([a-z]+)/i);
  if (untilMatch) {
    const end = dateFromDayMonth(untilMatch[1], untilMatch[2], year);
    return Boolean(end && compareDateLabels(window.todayLabel, end) <= 0);
  }

  const singleDate = normalized.match(/\b(\d{1,2})\s+([a-z]+)\b/i);
  if (singleDate) {
    return dateFromDayMonth(singleDate[1], singleDate[2], year) === window.todayLabel;
  }

  return true;
};

const parseLondonistEvents = (xml, window) => {
  const items = parseRssItems(xml).filter((item) => /things to do in london/i.test(item.title));
  const events = [];

  for (const item of items.slice(0, 4)) {
    let sectionDate = /weekend/i.test(item.title) ? null : window.todayLabel;
    let currentImage = item.image;
    const tokens = [...item.content.matchAll(/<h2[^>]*>[\s\S]*?<\/h2>|<img\b[^>]*>|<p\b[^>]*>[\s\S]*?<\/p>/gi)];

    for (const [token] of tokens) {
      if (/^<h2/i.test(token)) {
        sectionDate = londonistSectionDate(stripTags(token), window);
        continue;
      }

      if (/^<img/i.test(token)) {
        currentImage = bestImageFromHtml(token, LONDONIST_FEED_URL) ?? currentImage;
        continue;
      }

      if (!sectionDate || sectionDate !== window.todayLabel) continue;
      const strongMatches = [...token.matchAll(/<strong[^>]*>([\s\S]*?)<\/strong>/gi)].map((match) => stripTags(match[1]));
      const rawTitle = strongMatches[0] ?? '';
      const title = rawTitle.replace(/:\s*$/, '').trim();
      if (!title || title.length < 4 || /sponsor message/i.test(title)) continue;

      const href = token.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];
      const description = stripTags(token)
        .replace(strongMatches[0] ?? '', '')
        .replace(strongMatches.at(-1) ?? '', '')
        .replace(/^:\s*/, '')
        .slice(0, 260);
      if (description.length < 45) continue;

      const time = strongMatches.at(-1) && strongMatches.at(-1) !== strongMatches[0]
        ? strongMatches.at(-1)
        : 'See details';
      if (!londonistTimeApplies(time, sectionDate, window)) continue;
      const startsAt = parseLondonTime(sectionDate, time);
      const type = inferType(title, description);

      events.push(normalizeEvent({
        title,
        type,
        venue: 'Londonist pick',
        address: 'London',
        date: sectionDate,
        time,
        description,
        url: absoluteUrl(href, item.link) ?? item.link,
        image: currentImage,
        source: 'Londonist',
        startsAt,
      }));
    }
  }

  return events.slice(0, 12);
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
  const cards = [...html.matchAll(/<article[\s\S]*?<\/article>|<li[\s\S]*?<\/li>|<div[^>]+class=["'][^"']*(?:event|card|listing|teaser|programme|tile)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi)].slice(0, 120);
  const events = [];
  const normalizeLabel = (value) => value.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
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
    'go to the content',
    'skip to main content',
    'things to do in london',
    'view all',
    'read more',
    'load more',
    'search',
    'menu',
  ]);

  for (const [card] of cards) {
    const anchor = card.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const title = stripTags(card.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i)?.[1] ?? anchor?.[2] ?? '');
    if (!title || title.length < 4) continue;
    if (title.length > 120) continue;
    if (genericLabels.has(normalizeLabel(title))) continue;

    const url = absoluteUrl(anchor?.[1], baseUrl);
    if (!url || url === baseUrl) continue;
    if (new URL(url).hostname !== new URL(baseUrl).hostname && !/^https?:\/\/(www\.)?(eventbrite|dice|ticketmaster|songkick|meetup|outsavvy|designmynight|seetickets|dice)\./i.test(url)) continue;
    const image = bestImageFromHtml(card, baseUrl);
    const description = stripTags(card).replace(title, '').slice(0, 260);
    if (/\b(window|digitalData|pageInstanceID|timestamp|sysEnv|cookie|privacy policy|newsletter|advertising|subscribe)\b/i.test(description)) continue;
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

const fetchGenericLondonSource = async ({ source, url }, window) => {
  const html = await fetchText(url, 8500);
  return [
    ...parseJsonLdEvents(html, url, source, window),
    ...parseArticleCards(html, url, source, window),
  ].slice(0, 18);
};

const GENERIC_LONDON_SOURCES = [
  { source: 'London The Inside', url: LONDON_THE_INSIDE_URL },
  { source: 'Songkick', url: SONGKICK_LONDON_URL },
  { source: 'Secret London', url: SECRET_LDN_URL },
  { source: 'Barbican', url: BARBICAN_URL },
  { source: 'BFI', url: BFI_URL },
  { source: 'The Nudge', url: THE_NUDGE_URL },
  { source: 'Somerset House', url: SOMERSET_HOUSE_URL },
  { source: 'Ents24', url: ENTS24_LONDON_URL },
  { source: 'Intelligence Squared', url: INTELLIGENCE_SQUARED_URL },
  { source: 'Meetup London', url: MEETUP_LONDON_URL },
  { source: 'Eventbrite Free London', url: EVENTBRITE_FREE_LONDON_URL },
  { source: 'Royal Institution', url: ROYAL_INSTITUTION_URL },
  { source: 'London Museum', url: LONDON_MUSEUM_URL },
  { source: 'Gresham College', url: GRESHAM_URL },
];

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
    const preferred = sourceRank(event) < sourceRank(current) ? event : current;
    const alternate = preferred === event ? current : event;
    byKey.set(key, {
      ...preferred,
      source: Array.from(new Set([preferred.source, alternate.source].filter(Boolean))).join(' + '),
      image: hasScrapedImage(preferred) ? preferred.image : alternate.image,
      description: preferred.description.length >= alternate.description.length ? preferred.description : alternate.description,
      startsAt: preferred.startsAt || alternate.startsAt,
    });
  }

  return Array.from(byKey.values());
};

const sortEvents = (events) => events.sort((a, b) => {
  const audienceRank = childAudienceRank(a) - childAudienceRank(b);
  if (audienceRank !== 0) return audienceRank;

  const evergreenRank = evergreenGuideRank(a) - evergreenGuideRank(b);
  if (evergreenRank !== 0) return evergreenRank;

  const freeRank = priceRank(a) - priceRank(b);
  if (freeRank !== 0) return freeRank;

  const oneOffRank = recurringRank(a) - recurringRank(b);
  if (oneOffRank !== 0) return oneOffRank;

  const imageRank = Number(hasScrapedImage(b)) - Number(hasScrapedImage(a));
  if (imageRank !== 0) return imageRank;

  const sourcePriorityRank = sourceRank(a) - sourceRank(b);
  if (sourcePriorityRank !== 0) return sourcePriorityRank;

  const left = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  const right = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  return left - right;
});

const interleaveSources = (events) => {
  const buckets = new Map();
  for (const event of events) {
    const key = sourceKey(event);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(event);
  }

  const orderedKeys = [...buckets.keys()].sort((left, right) => {
    const leftFirst = buckets.get(left)[0];
    const rightFirst = buckets.get(right)[0];
    return sourceRank(leftFirst) - sourceRank(rightFirst);
  });
  const output = [];
  let previousKey = null;

  while (output.length < events.length) {
    const availableKeys = orderedKeys.filter((key) => buckets.get(key)?.length);
    if (!availableKeys.length) break;
    const nextKey = availableKeys.find((key) => key !== previousKey) ?? availableKeys[0];
    output.push(buckets.get(nextKey).shift());
    previousKey = nextKey;
  }

  return output;
};

const qualityGroupKey = (event) => [
  childAudienceRank(event),
  priceRank(event),
  recurringRank(event),
  Number(!hasScrapedImage(event)),
  evergreenGuideRank(event),
].join(':');

const mixEvents = (events) => {
  const sorted = sortEvents(events);
  const groups = new Map();

  for (const event of sorted) {
    const key = qualityGroupKey(event);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }

  return softenSourceRuns([...groups.values()].flatMap(interleaveSources));
};

const softenSourceRuns = (events, maxRun = 3) => {
  const mixed = [...events];
  for (let index = maxRun; index < mixed.length; index += 1) {
    const currentSource = sourceKey(mixed[index]);
    const isRun = mixed
      .slice(index - maxRun, index)
      .every((event) => sourceKey(event) === currentSource);

    if (!isRun) continue;

    const replacementIndex = mixed.findIndex((event, candidateIndex) => (
      candidateIndex > index
      && sourceKey(event) !== currentSource
      && childAudienceRank(event) === childAudienceRank(mixed[index])
      && evergreenGuideRank(event) === evergreenGuideRank(mixed[index])
    ));

    if (replacementIndex > index) {
      const [replacement] = mixed.splice(replacementIndex, 1);
      mixed.splice(index, 0, replacement);
    }
  }

  return mixed;
};

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
      fetcher: async () => enrichIanVisitsImages(parseIanVisitsEvents(await fetchText(IAN_VISITS_URL), window)),
    },
    {
      source: 'Londonist',
      phase: 'fast',
      fetcher: async () => parseLondonistEvents(await fetchText(LONDONIST_FEED_URL), window),
    },
    {
      source: 'Resident Advisor',
      phase: 'fast',
      fetcher: async () => fetchRaLondonEvents(window),
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
    ...GENERIC_LONDON_SOURCES.map((sourceConfig) => ({
      source: sourceConfig.source,
      phase: 'full',
      fetcher: async () => fetchGenericLondonSource(sourceConfig, window),
    })),
  ].filter((source) => normalizedPhase === 'full' || source.phase === 'fast');

  const results = await Promise.all(sources.map((source) => runSource(source.source, source.fetcher, normalizedPhase === 'fast' ? 7000 : 11_000)));
  const filteredResults = results.map((source) => ({
    ...source,
    events: source.events.filter((event) => isInWindow(event, window)),
  }));
  const events = mixEvents(dedupeEvents(filteredResults.flatMap((source) => source.events))).slice(0, 80);

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
