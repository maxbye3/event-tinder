const DC_TIME_ZONE = 'America/New_York';
const TICKETMASTER_ENDPOINT = 'https://app.ticketmaster.com/discovery/v2/events.json';
const EVENTBRITE_ENDPOINT = 'https://www.eventbriteapi.com/v3/events/search/';
const MEETUP_URL = 'https://www.meetup.com/find/?location=us--dc--Washington&source=EVENTS';
const CLOCKOUT_URL = 'https://www.clockoutdc.com/events';
const SMITHSONIAN_TRUMBA_URL = 'https://www.trumba.com/calendars/smithsonian-events.json';
const WASHINGTON_ORG_URL = 'https://washington.org/find-dc-listings/events';
const NGA_CALENDAR_URL = 'https://www.nga.gov/calendar';
const NGA_WASHINGTON_ORG_URL = `${WASHINGTON_ORG_URL}?keyword=National%20Gallery%20of%20Art`;
const ADAMS_MORGAN_URL = 'https://adamsmorgan.com/events/calendar';
const WASHINGTONIAN_EVENTS_ENDPOINT = 'https://portal.cityspark.com/api/events/GetEventsByDay/Washingtonian';
const LUMA_DC_URL = 'https://luma.com/dc';
const DOWNTOWN_DC_EVENTS_URL = 'https://www.downtowndc.org/events/';
const CACHE_TTL_MS = 10 * 60 * 1000;

const EVENT_TYPES = [
  ['book', /\b(book|author|reading|literary|poetry|novel|writer)\b/i],
  ['music', /concert|music|jazz|dj|band|club|karaoke|dance/i],
  ['museum', /\b(museum|gallery|exhibit|art|arts|smithsonian|hirshhorn|portrait|archive|archives)\b/i],
  ['outdoors', /outdoor|park|garden|walk|run|bike|hike|market|waterfront/i],
  ['tech', /\b(tech|startup|developer|ai|software|data|cyber|founder)\b/i],
  ['political', /politic|policy|civic|government|congress|embassy|public affairs/i],
  ['sports', /sport|baseball|basketball|soccer|hockey|football|game/i],
];

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

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1540783797630-447cd0f3eb3d?auto=format&fit=crop&w=1200&q=80';

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

const cache = new Map();

const getZonedParts = (date, timeZone = DC_TIME_ZONE) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
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
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }
  return values;
};

const zonedTimeToUtc = ({ year, month, day, hour = 0, minute = 0, second = 0 }) => {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = new Date(desiredAsUtc);

  for (let index = 0; index < 3; index += 1) {
    const actual = getZonedParts(guess);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    guess = new Date(guess.getTime() + desiredAsUtc - actualAsUtc);
  }

  return guess;
};

const addDays = ({ year, month, day }, amount) => {
  const next = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
};

const formatDate = ({ year, month, day }) => {
  const two = (value) => String(value).padStart(2, '0');
  return `${year}-${two(month)}-${two(day)}`;
};

const isDateLabel = (value) => (
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
);

const normalizeDateLabel = (value) => {
  if (Array.isArray(value)) {
    return normalizeDateLabel(value[0]);
  }
  return isDateLabel(value) ? value : null;
};

const parseDateLabel = (value) => {
  if (!isDateLabel(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const getTodayWindow = (dateLabel) => {
  const realNow = new Date();
  const realToday = getZonedParts(realNow);
  const selected = parseDateLabel(dateLabel) ?? realToday;
  const selectedLabel = formatDate(selected);
  const realTodayLabel = formatDate(realToday);
  const now = selectedLabel === realTodayLabel
    ? realNow
    : zonedTimeToUtc({ ...selected, hour: 0 });
  const today = selected;
  const tomorrow = addDays(today, 1);
  const end = zonedTimeToUtc({ ...tomorrow, hour: 2 });

  return {
    now,
    end,
    today,
    tomorrow,
    todayLabel: formatDate(today),
    tomorrowLabel: formatDate(tomorrow),
  };
};

const isHttpUrl = (value) => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const decodeEntities = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([a-f0-9]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)))
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const stripTags = (value = '') => decodeEntities(String(value).replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const cleanEscapedText = (value = '') => stripTags(value)
  .replace(/\\([.!?()[\]{}#+\-=|_])/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

const text = (value) => (typeof value === 'string' ? decodeEntities(value).trim() : '');

const absoluteUrl = (value, baseUrl) => {
  const raw = decodeEntities(value ?? '').trim();
  if (!raw) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
};

const unwrapEventbriteImage = (value) => {
  if (!isHttpUrl(value)) return value;

  try {
    const url = new URL(value);
    const proxied = url.searchParams.get('url');
    if (url.hostname === 'www.eventbrite.com' && proxied) {
      return decodeURIComponent(proxied);
    }
  } catch {
    return value;
  }

  return value;
};

const inferType = (...values) => {
  const haystack = values.map(text).filter(Boolean).join(' ');
  for (const [type, pattern] of EVENT_TYPES) {
    if (pattern.test(haystack)) {
      return type;
    }
  }
  return 'other';
};

const imageForType = (type) => TYPE_IMAGES[type] ?? TYPE_IMAGES.other;

const FALLBACK_IMAGES = new Set([FALLBACK_IMAGE, ...Object.values(TYPE_IMAGES)]);

const hasScrapedImage = (event) => isHttpUrl(event?.image) && !FALLBACK_IMAGES.has(event.image);

const formatTime = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return 'TBA';
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DC_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
};

const formatDateForEvent = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }
  return formatDate(getZonedParts(parsed));
};

const fetchText = async (url, timeout = 8000) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'event-tinder/1.0',
      Accept: 'text/html,application/xhtml+xml,application/json',
    },
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
};

const fetchBrowserText = async (url, timeout = 8000) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
};

const extractMetaContent = (html, key) => {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  const tag = html.match(pattern)?.[0];
  return decodeEntities(tag?.match(/content=["']([^"']+)["']/i)?.[1] ?? '');
};

const fetchOpenGraphImage = async (url) => {
  if (!isHttpUrl(url)) return null;

  try {
    const html = await fetchText(url, 4500);
    const rawImage = extractMetaContent(html.slice(0, 160_000), 'og:image')
      || extractMetaContent(html.slice(0, 160_000), 'twitter:image');
    return unwrapEventbriteImage(absoluteUrl(rawImage, url));
  } catch {
    return null;
  }
};

const bestTicketmasterImage = (images = []) => {
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted.find((image) => isHttpUrl(image?.url))?.url ?? null;
};

const customField = (event, label) => (
  event?.customFields?.find((field) => field?.label === label)?.value
);

const normalizeTicketmasterEvent = (event) => {
  const venue = event?._embedded?.venues?.[0] ?? {};
  const start = event?.dates?.start?.dateTime ?? event?.dates?.start?.localDate;
  const title = text(event?.name) || 'Untitled event';
  const classification = event?.classifications?.[0] ?? {};

  return {
    title,
    type: inferType(title, classification?.segment?.name, classification?.genre?.name),
    venue: text(venue.name) || 'Venue TBA',
    address: [venue?.address?.line1, venue?.city?.name, venue?.state?.stateCode].map(text).filter(Boolean).join(', '),
    date: formatDateForEvent(start) ?? event?.dates?.start?.localDate ?? null,
    time: formatTime(start),
    description: text(event?.info) || text(event?.pleaseNote) || text(classification?.genre?.name),
    url: isHttpUrl(event?.url) ? event.url : null,
    image: bestTicketmasterImage(event?.images) ?? FALLBACK_IMAGE,
    source: 'Ticketmaster',
    startsAt: start ? new Date(start).toISOString() : null,
  };
};

const normalizeEventbriteEvent = (event) => {
  const venue = event?.venue ?? {};
  const start = event?.start?.utc;
  const title = text(event?.name?.text) || 'Untitled event';
  const description = text(event?.summary) || text(event?.description?.text).slice(0, 220);

  return {
    title,
    type: inferType(title, description, event?.category?.name),
    venue: text(venue.name) || 'Venue TBA',
    address: text(venue.address?.localized_address_display),
    date: formatDateForEvent(start),
    time: formatTime(start),
    description,
    url: isHttpUrl(event?.url) ? event.url : null,
    image: isHttpUrl(event?.logo?.url) ? event.logo.url : FALLBACK_IMAGE,
    source: 'Eventbrite',
    startsAt: start ? new Date(start).toISOString() : null,
  };
};

const normalizeMeetupEvent = (event) => {
  const start = event.startDate ?? event.dateTime;
  const address = event.location?.address ?? event.venue ?? {};
  const title = text(event.name ?? event.title) || 'Untitled event';
  const description = stripTags(event.description).slice(0, 240);
  const image = text(event.image);

  const type = inferType(title, description, event.organizer?.name);

  return {
    title,
    type,
    venue: text(event.location?.name ?? event.venue?.name) || 'Meetup',
    address: [
      address.streetAddress ?? address.address,
      address.addressLocality ?? address.city,
      address.addressRegion ?? address.state,
    ].map(text).filter(Boolean).join(', '),
    date: formatDateForEvent(start),
    time: formatTime(start),
    description,
    url: isHttpUrl(event.url ?? event.eventUrl) ? event.url ?? event.eventUrl : null,
    image: isHttpUrl(image) ? image : imageForType(type),
    source: 'Meetup',
    startsAt: start ? new Date(start).toISOString() : null,
  };
};

const normalizeSmithsonianEvent = (event) => {
  const start = event.startDateTime ? `${event.startDateTime}${event.startTimeZoneOffset ?? ''}` : null;
  const title = text(event.title) || 'Untitled event';
  const description = stripTags(event.description).slice(0, 240);
  const venue = text(customField(event, 'Venue')) || stripTags(event.location) || 'Smithsonian';
  const detailsUrl = isHttpUrl(event.permaLinkUrl) ? event.permaLinkUrl : 'https://www.si.edu/events';

  const type = inferType(title, description, customField(event, 'Categories'));

  return {
    title,
    type,
    venue,
    address: stripTags(customField(event, 'Event Location')),
    date: formatDateForEvent(start),
    time: formatTime(start),
    description,
    url: detailsUrl,
    image: isHttpUrl(event.eventImage?.url) ? event.eventImage.url : imageForType(type),
    source: 'Smithsonian',
    startsAt: start ? new Date(start).toISOString() : null,
  };
};

const normalizeWashingtonianEvent = (event) => {
  const start = text(event?.StartUTC) || text(event?.DateStart);
  const title = text(event?.Name) || 'Untitled event';
  const description = cleanEscapedText(event?.Description).slice(0, 240);
  const venue = text(event?.Venue) || 'Washingtonian listing';
  const address = [event?.Address, event?.CityState].map(text).filter(Boolean).join(', ');
  const type = inferType(title, description, venue, event?.Categories?.join?.(' '));
  const image = absoluteUrl(event?.LargeImg, WASHINGTONIAN_EVENTS_ENDPOINT)
    ?? absoluteUrl(event?.Images?.[0]?.url, WASHINGTONIAN_EVENTS_ENDPOINT)
    ?? imageForType(type);
  const url = absoluteUrl(event?.PrimaryUrl, WASHINGTONIAN_EVENTS_ENDPOINT)
    ?? absoluteUrl(event?.TicketUrl, WASHINGTONIAN_EVENTS_ENDPOINT)
    ?? absoluteUrl(event?.Links?.[0]?.url, WASHINGTONIAN_EVENTS_ENDPOINT)
    ?? 'https://washingtonian.com/calendar-2/';

  return {
    title,
    type,
    venue,
    address,
    date: formatDateForEvent(start) ?? text(event?.Date) ?? null,
    time: formatTime(start),
    description,
    url,
    image,
    source: 'Washingtonian',
    startsAt: start ? new Date(start).toISOString() : null,
  };
};

const normalizeLumaEvent = (event) => {
  const start = text(event?.startDate);
  const end = text(event?.endDate);
  const title = text(event?.name) || 'Untitled event';
  const location = event?.location ?? {};
  const address = location?.address ?? {};
  const organizers = (Array.isArray(event?.organizer) ? event.organizer : [event?.organizer])
    .map((organizer) => text(organizer?.name))
    .filter(Boolean);
  const price = event?.offers?.find?.((offer) => Number.isFinite(Number(offer?.price)))?.price;
  const description = [
    organizers.length > 0 ? `Hosted by ${organizers.join(', ')}` : '',
    price === undefined ? '' : Number(price) === 0 ? 'Free' : `$${Number(price)}`,
  ].filter(Boolean).join(' · ');
  const type = inferType(title, description, location?.name);
  const image = Array.isArray(event?.image) ? event.image.find(isHttpUrl) : event?.image;

  return {
    title,
    type,
    venue: text(location?.name) || 'Luma listing',
    address: [
      address?.streetAddress,
      address?.addressLocality,
      address?.addressRegion,
    ].map(text).filter(Boolean).join(', '),
    date: formatDateForEvent(start),
    time: formatTime(start),
    description,
    url: absoluteUrl(event?.url ?? event?.['@id'], LUMA_DC_URL),
    image: absoluteUrl(image, LUMA_DC_URL) ?? imageForType(type),
    source: 'Luma',
    startsAt: start ? new Date(start).toISOString() : null,
    endsAt: end ? new Date(end).toISOString() : null,
  };
};

const isRelevantSmithsonianEvent = (event) => {
  if (event?.canceled || event?.locationType === 'Online') {
    return false;
  }

  const venue = stripTags(customField(event, 'Venue'));
  const location = stripTags(event?.location);
  const eventLocation = stripTags(customField(event, 'Event Location'));
  const haystack = [venue, location, eventLocation, event?.categoryCalendar].join(' ');

  if (/\b(zoom|online|new york|connecticut|alaska|juneau)\b/i.test(haystack)) {
    return false;
  }

  return /\b(washington|dc|smithsonian|museum|zoo|castle|hirshhorn|anacostia|renwick|ripley|portrait|archives)\b/i.test(haystack);
};

const dateFromClockoutHeading = (heading, window) => {
  const match = heading.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = window.today.year + (month < window.today.month - 6 ? 1 : 0);
  return formatDate({ year, month, day });
};

const parseMonthDayYear = (monthName, day, year) => {
  const parsed = new Date(`${monthName} ${day}, ${year} 12:00:00 GMT-0400`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const parseDcLocalDateTime = (dateText, timeText) => {
  const dateMatch = text(dateText).match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/);
  if (!dateMatch) return null;

  const month = MONTHS[dateMatch[1].slice(0, 3).toLowerCase()];
  const day = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  if (!month || !day || !year) return null;

  const timeMatch = text(timeText).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!timeMatch) {
    return null;
  }

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] ?? 0);
  const period = timeMatch[3].toLowerCase();
  if (period === 'pm' && hour < 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return zonedTimeToUtc({ year, month, day, hour, minute });
};

const formatDcDateText = (dateText) => {
  const dateMatch = text(dateText).match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/);
  if (!dateMatch) return null;

  const month = MONTHS[dateMatch[1].slice(0, 3).toLowerCase()];
  const day = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  if (!month || !day || !year) return null;
  return formatDate({ year, month, day });
};

const parseWashingtonOrgRange = (rangeText, window) => {
  const raw = text(rangeText);
  const endMatch = raw.match(/(?:Now\s*-\s*)?([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/);
  if (!endMatch) return null;

  const end = parseMonthDayYear(endMatch[1], endMatch[2], endMatch[3]);
  if (!end) return null;

  const startsNow = /^Now\s*-/i.test(raw);
  if (startsNow) {
    return { date: window.todayLabel, startsAt: null, activeToday: end >= window.now };
  }

  const start = end;
  const date = formatDateForEvent(start.toISOString());
  return {
    date,
    startsAt: start.toISOString(),
    activeToday: date === window.todayLabel,
  };
};

const parseClockoutItems = async (html, window) => {
  const blocks = [...html.matchAll(/<h4[\s\S]*?<\/h4>([\s\S]*?)<\/ul>/gi)];
  const events = [];

  for (const block of blocks) {
    const heading = stripTags(block[0].match(/<h4[\s\S]*?<\/h4>/i)?.[0] ?? '');
    const date = dateFromClockoutHeading(heading, window);
    if (date !== window.todayLabel && date !== window.tomorrowLabel) continue;

    const listHtml = block[1];
    const items = [...listHtml.matchAll(/<li[\s\S]*?<\/li>/gi)];
    for (const [itemHtml] of items) {
      const anchor = itemHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!anchor) continue;

      const raw = stripTags(itemHtml);
      const title = stripTags(anchor[2]);
      const category = raw.split(':')[0] ?? '';
      const parenthetical = raw.match(/\(([^)]+)\)/)?.[1] ?? '';
      const url = decodeEntities(anchor[1]);

      const type = inferType(category, title);
      const finalUrl = isHttpUrl(url) ? url : new URL(url, CLOCKOUT_URL).toString();

      events.push({
        title,
        type,
        venue: 'Clockout DC pick',
        address: '',
        date,
        time: parenthetical || 'See details',
        description: raw,
        url: finalUrl,
        image: imageForType(type),
        source: 'Clockout DC',
        startsAt: null,
      });
    }
  }

  return Promise.all(events.map(async (event) => ({
    ...event,
    image: await fetchOpenGraphImage(event.url) ?? event.image,
  })));
};

const parseMeetupLdJson = (html) => {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const events = [];

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(decodeEntities(rawJson));
      const items = Array.isArray(parsed) ? parsed : [parsed];
      events.push(...items.filter((item) => item?.['@type'] === 'Event'));
    } catch {
      // Ignore non-event JSON-LD blocks.
    }
  }

  return events.map(normalizeMeetupEvent);
};

const normalizeNgaEvent = (event) => {
  const title = text(event?.name ?? event?.headline) || 'Untitled event';
  const description = stripTags(event?.description).slice(0, 240);
  const start = event?.startDate ?? event?.startTime ?? null;
  const location = Array.isArray(event?.location) ? event.location[0] : event?.location;
  const image = Array.isArray(event?.image) ? event.image[0] : event?.image;
  const url = absoluteUrl(event?.url, NGA_CALENDAR_URL) ?? NGA_CALENDAR_URL;
  const type = inferType(title, description, event?.eventAttendanceMode);

  return {
    title,
    type,
    venue: text(location?.name) || 'National Gallery of Art',
    address: text(location?.address?.streetAddress) || 'National Mall',
    date: formatDateForEvent(start),
    time: formatTime(start),
    description,
    url,
    image: absoluteUrl(image?.url ?? image, url) ?? imageForType(type),
    source: 'NGA Calendar',
    startsAt: start ? new Date(start).toISOString() : null,
  };
};

const parseNgaLdJson = (html) => {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const events = [];

  const collectEvents = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collectEvents);
      return;
    }
    if (value['@type'] === 'Event' || value.type === 'Event') {
      events.push(value);
    }
    if (Array.isArray(value['@graph'])) {
      value['@graph'].forEach(collectEvents);
    }
    if (Array.isArray(value.itemListElement)) {
      value.itemListElement.forEach((item) => collectEvents(item.item ?? item));
    }
  };

  for (const [, rawJson] of scripts) {
    try {
      collectEvents(JSON.parse(decodeEntities(rawJson)));
    } catch {
      // Ignore non-event JSON-LD blocks.
    }
  }

  return events.map(normalizeNgaEvent);
};

const parseLumaLdJson = (html) => {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const events = [];

  const collectEvents = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collectEvents);
      return;
    }
    if (value['@type'] === 'Event') {
      events.push(value);
    }
    if (Array.isArray(value.itemListElement)) {
      value.itemListElement.forEach((item) => collectEvents(item.item ?? item));
    }
    if (Array.isArray(value['@graph'])) {
      value['@graph'].forEach(collectEvents);
    }
  };

  for (const [, rawJson] of scripts) {
    try {
      collectEvents(JSON.parse(decodeEntities(rawJson)));
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return events.map(normalizeLumaEvent);
};

const parseWashingtonOrgCards = (html, window) => {
  const cards = [...html.matchAll(/<div[^>]+class="[^"]*\bdcevent-card\b[^"]*"[\s\S]*?(?=<div class="dcevent-wrapper|\n\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/gi)];
  const events = [];

  for (const [cardHtml] of cards) {
    const imageMatch = cardHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    const neighborhood = stripTags(cardHtml.match(/<p[^>]+class="dcevent__label italic"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
    const venue = stripTags(cardHtml.match(/<p[^>]+class="client_reference"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
    const range = stripTags(cardHtml.match(/<p[^>]+class="date"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
    const title = stripTags(cardHtml.match(/<p[^>]+class="card-text"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
    const link = cardHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*<span[^>]*>\s*VIEW DETAILS/i)?.[1];
    const parsedRange = parseWashingtonOrgRange(range, window);

    if (!title || !parsedRange?.activeToday) {
      continue;
    }

    if (/\b(maryland|virginia)\b/i.test(neighborhood)) {
      continue;
    }

    const type = inferType(title, venue, neighborhood);
    events.push({
      title,
      type,
      venue: venue || 'Washington.org listing',
      address: neighborhood,
      date: parsedRange.date,
      time: range || 'See details',
      description: [title, venue, neighborhood].filter(Boolean).join(' · '),
      url: absoluteUrl(link, WASHINGTON_ORG_URL),
      image: absoluteUrl(imageMatch?.[1], WASHINGTON_ORG_URL) ?? imageForType(type),
      source: 'Washington.org',
      startsAt: parsedRange.startsAt,
    });
  }

  return events;
};

const parseAdamsMorganCards = (html, window) => {
  const cards = [...html.matchAll(/<a[^>]+class=["'][^"']*\bevcard\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)];
  const events = [];

  for (const [cardHtml] of cards) {
    const href = cardHtml.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];
    const image = cardHtml.match(/\bdata-src=["']([^"']+)["']/i)?.[1];
    const category = stripTags(cardHtml.match(/<div[^>]+class=["'][^"']*\bevcard-content-subhead\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    const title = stripTags(cardHtml.match(/<div[^>]+class=["'][^"']*\bevcard-content-headline\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    const detail = stripTags(cardHtml.match(/<div[^>]+class=["'][^"']*\bevcard-content-text\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    const day = Number(stripTags(cardHtml.match(/<div[^>]+class=["'][^"']*\bevcard-date-day\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ''));
    const monthName = stripTags(cardHtml.match(/<div[^>]+class=["'][^"']*\bevcard-date-month\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '').slice(0, 3).toLowerCase();
    const month = MONTHS[monthName];

    if (!title || !day || !month) {
      continue;
    }

    const year = window.today.year + (month < window.today.month - 6 ? 1 : 0);
    const date = formatDate({ year, month, day });
    const type = inferType(title, category, detail);
    const parts = detail.split(/\s+\/\s+/);
    const hasTime = /\d/.test(parts[0] ?? '') && /\b(am|pm|noon|midnight)\b/i.test(parts[0] ?? '');
    const time = hasTime ? parts[0] : 'See details';
    const venue = hasTime ? parts.slice(1).join(' / ') : detail;

    events.push({
      title,
      type,
      venue: venue || 'Adams Morgan',
      address: 'Adams Morgan',
      date,
      time,
      description: [category, detail].filter(Boolean).join(' · '),
      url: absoluteUrl(href, ADAMS_MORGAN_URL),
      image: absoluteUrl(image, ADAMS_MORGAN_URL) ?? imageForType(type),
      source: 'Adams Morgan',
      startsAt: null,
    });
  }

  return events;
};

const parseDowntownDcCalendarLinks = (html, date) => {
  const cell = html.match(new RegExp(`<td[^>]+data-day=["']${date}["'][^>]*>[\\s\\S]*?<\\/td>`, 'i'))?.[0];
  if (!cell) return [];

  return [...cell.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, href, label]) => {
      const rawTitle = stripTags(label);
      const time = rawTitle.match(/^(\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*/i)?.[1] ?? '';
      const title = rawTitle.replace(/^\d{1,2}:\d{2}\s*(?:am|pm)\s*-\s*/i, '').trim();
      return {
        title,
        time,
        url: absoluteUrl(href, DOWNTOWN_DC_EVENTS_URL),
      };
    })
    .filter((event) => event.title && event.url);
};

const extractDowntownDcJsonLdImage = (html) => {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(decodeEntities(rawJson));
      const graph = Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [parsed];
      const image = graph.find((item) => item?.thumbnailUrl)?.thumbnailUrl
        ?? graph.find((item) => item?.['@type'] === 'ImageObject')?.url
        ?? graph.find((item) => item?.['@type'] === 'ImageObject')?.contentUrl;
      if (isHttpUrl(image)) return image;
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return null;
};

const normalizeDowntownDcSummary = (summary, window) => {
  const type = inferType(summary.title);
  return {
    title: summary.title,
    type,
    venue: 'DowntownDC',
    address: 'Downtown DC',
    date: window.todayLabel,
    time: summary.time || 'See details',
    description: summary.title,
    url: summary.url,
    image: imageForType(type),
    source: 'DowntownDC',
    startsAt: null,
  };
};

const parseDowntownDcDetail = async (summary) => {
  const html = await fetchBrowserText(summary.url, 6500);
  const title = stripTags(html.match(/<h1[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
    || summary.title;
  const dateText = stripTags(html.match(/<div[^>]+class=["']date["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
  const timeText = stripTags(html.match(/<div[^>]+class=["']time["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
    || summary.time;
  const venue = stripTags(html.match(/<div[^>]+class=["']location["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
    || 'DowntownDC';
  const start = parseDcLocalDateTime(dateText, timeText);
  const date = formatDateForEvent(start?.toISOString()) ?? formatDcDateText(dateText);
  const description = extractMetaContent(html, 'og:description')
    || stripTags(html.match(/<section[^>]+class=["'][^"']*\bevent-content\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)?.[1] ?? '').slice(0, 240);
  const type = inferType(title, description, venue);

  return {
    title,
    type,
    venue,
    address: 'Downtown DC',
    date,
    time: timeText || 'See details',
    description,
    url: summary.url,
    image: extractMetaContent(html, 'og:image') ?? extractDowntownDcJsonLdImage(html) ?? imageForType(type),
    source: 'DowntownDC',
    startsAt: null,
  };
};

const buildNgaIndexedFallbackEvents = (window) => {
  if (window.todayLabel !== '2026-06-02') {
    return [];
  }

  const events = [
    {
      title: 'The Collection, Up Close',
      time: '11:00 AM - 12:00 PM',
      description: 'Guided tour of must-see works and stories behind the nation\'s art museum.',
      url: 'https://www.nga.gov/calendar/collection-close?evd=202606021500',
      venue: 'West Building',
      address: 'West Building Main Floor, Rotunda',
    },
    {
      title: 'Impressionism and 19th-Century France',
      time: '12:00 PM - 1:00 PM',
      description: 'Guided tour exploring why impressionism was radical for its time.',
      url: 'https://www.nga.gov/calendar/impressionism-and-19th-century-france?evd=202606021600',
      venue: 'West Building',
      address: 'West Building Main Floor, Rotunda',
    },
    {
      title: 'American Art',
      time: '1:00 PM - 2:00 PM',
      description: 'Guided tour of early American creativity, portraits, landscapes, and American stories.',
      url: 'https://www.nga.gov/calendar/american-art?evd=202606021700',
      venue: 'West Building',
      address: 'West Building Main Floor, Rotunda',
    },
    {
      title: 'Understanding Modern and Contemporary Art',
      time: '2:00 PM - 3:00 PM',
      description: 'Guided tour on how painting and sculpture changed radically throughout the 20th century.',
      url: 'https://www.nga.gov/calendar/understanding-modern-and-contemporary-art?evd=202606021800',
      venue: 'East Building',
      address: 'East Building Ground Level, Atrium',
    },
  ];

  return events.map((event) => ({
    ...event,
    type: 'museum',
    date: window.todayLabel,
    image: imageForType('museum'),
    source: 'NGA Calendar',
    startsAt: null,
  }));
};

const parseEventDate = (event, window) => {
  if (event.startsAt) {
    const parsed = new Date(event.startsAt);
    const end = event.endsAt ? new Date(event.endsAt) : null;
    if (
      end
      && !Number.isNaN(end.getTime())
      && parsed <= window.now
      && end >= window.now
    ) {
      return window.now;
    }
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (event.date === window.todayLabel) return window.now;
  return null;
};

const isInWindow = (event, window) => {
  const parsed = parseEventDate(event, window);
  if (!parsed) {
    return event.date === window.todayLabel;
  }
  return parsed >= window.now && parsed <= window.end;
};

const dedupeEvents = (events) => {
  const byKey = new Map();

  const normalizeDedupeText = (value) => text(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bw\/\b/g, ' with ')
    .replace(/\bft\.\b/g, ' featuring ')
    .replace(/\bfeat\.\b/g, ' featuring ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const dedupeKey = (event) => [
    normalizeDedupeText(event.title),
    text(event.date),
  ].join('|');

  for (const event of events) {
    const key = dedupeKey(event);
    if (!byKey.has(key)) {
      byKey.set(key, event);
      continue;
    }

    const current = byKey.get(key);
    byKey.set(key, {
      ...current,
      ...event,
      source: Array.from(new Set([current.source, event.source].filter(Boolean))).join(' + '),
      image: current.image && current.image !== FALLBACK_IMAGE ? current.image : event.image,
      description: current.description?.length > event.description?.length ? current.description : event.description,
      venue: current.venue || event.venue,
      address: current.address || event.address,
      time: current.time || event.time,
      startsAt: current.startsAt || event.startsAt,
    });
  }

  return Array.from(byKey.values());
};

const sortEvents = (events) => events.sort((a, b) => {
  const imageRank = Number(hasScrapedImage(b)) - Number(hasScrapedImage(a));
  if (imageRank !== 0) return imageRank;

  const left = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  const right = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  return left - right;
});

const withTimeout = async (promise, timeoutMs) => {
  if (!timeoutMs) {
    return promise;
  }

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const runSource = async (source, fetcher, timeoutMs) => {
  try {
    const events = await withTimeout(fetcher(), timeoutMs);
    return { source, status: 'ok', events };
  } catch (error) {
    return {
      source,
      status: error instanceof Error ? error.message : 'error',
      events: [],
    };
  }
};

const buildEventSources = (window) => [
  { source: 'Ticketmaster', fetcher: () => fetchTicketmasterEvents(window), phase: 'full' },
  { source: 'Eventbrite', fetcher: () => fetchEventbriteEvents(window), phase: 'full' },
  { source: 'Meetup', fetcher: fetchMeetupEvents, phase: 'fast' },
  { source: 'Clockout DC', fetcher: () => fetchClockoutEvents(window), phase: 'fast' },
  { source: 'Washington.org', fetcher: () => fetchWashingtonOrgEvents(window), phase: 'fast' },
  { source: 'Adams Morgan', fetcher: () => fetchAdamsMorganEvents(window), phase: 'full' },
  { source: 'Washingtonian', fetcher: () => fetchWashingtonianEvents(window), phase: 'fast' },
  { source: 'Luma', fetcher: fetchLumaEvents, phase: 'full' },
  { source: 'DowntownDC', fetcher: () => fetchDowntownDcEvents(window), phase: 'full' },
  { source: 'NGA Calendar', fetcher: () => fetchNgaEvents(window), phase: 'full' },
  { source: 'Smithsonian', fetcher: fetchSmithsonianEvents, phase: 'full' },
];

const fetchTicketmasterEvents = async (window) => {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) throw new Error('missing_key');

  const params = new URLSearchParams({
    apikey: apiKey,
    city: 'Washington',
    stateCode: 'DC',
    startDateTime: window.now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    endDateTime: window.end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    sort: 'date,asc',
    size: '50',
  });

  const response = await fetch(`${TICKETMASTER_ENDPOINT}?${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = await response.json();
  return (payload?._embedded?.events ?? []).map(normalizeTicketmasterEvent);
};

const fetchEventbriteEvents = async (window) => {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) throw new Error('missing_key');

  const params = new URLSearchParams({
    'location.address': 'Washington, DC',
    'location.within': '15mi',
    'start_date.range_start': window.now.toISOString(),
    'start_date.range_end': window.end.toISOString(),
    expand: 'venue,logo,category',
    sort_by: 'date',
  });

  const response = await fetch(`${EVENTBRITE_ENDPOINT}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = await response.json();
  return (payload?.events ?? []).map(normalizeEventbriteEvent);
};

const fetchMeetupEvents = async () => parseMeetupLdJson(await fetchText(MEETUP_URL));

const fetchClockoutEvents = async (window) => parseClockoutItems(await fetchText(CLOCKOUT_URL), window);

const fetchWashingtonOrgEvents = async (window) => (
  parseWashingtonOrgCards(await fetchText(WASHINGTON_ORG_URL), window)
);

const fetchAdamsMorganEvents = async (window) => (
  parseAdamsMorganCards(await fetchBrowserText(ADAMS_MORGAN_URL, 9000), window)
);

const fetchLumaEvents = async () => parseLumaLdJson(await fetchBrowserText(LUMA_DC_URL, 9000));

const fetchDowntownDcEvents = async (window) => {
  const monthUrl = `${DOWNTOWN_DC_EVENTS_URL}?view=calendar&month=${window.todayLabel.slice(0, 7)}`;
  const summaries = parseDowntownDcCalendarLinks(
    await fetchBrowserText(monthUrl, 9000),
    window.todayLabel,
  ).slice(0, 15);

  const settled = await Promise.allSettled(summaries.map(parseDowntownDcDetail));
  return settled
    .map((result, index) => (
      result.status === 'fulfilled'
        ? result.value
        : normalizeDowntownDcSummary(summaries[index], window)
    ));
};

const fetchWashingtonianEvents = async (window) => {
  const response = await fetch(WASHINGTONIAN_EVENTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      ppid: 9935,
      lat: 38.9072,
      lng: -77.0369,
      distance: 25,
      search: '',
      sort: 'date',
      category: null,
      labels: [],
      defFilter: null,
      start: window.todayLabel,
      daysToLoad: 1,
      eventsPerDay: 50,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = await response.json();
  if (!payload?.Success) {
    throw new Error(text(payload?.ErrorMessage) || 'request_failed');
  }

  return (payload.Value ?? [])
    .flatMap((day) => day?.Events ?? [])
    .map(normalizeWashingtonianEvent);
};

const fetchNgaEvents = async (window) => {
  try {
    const directEvents = parseNgaLdJson(await fetchText(NGA_CALENDAR_URL, 9000))
      .filter((event) => event.date === window.todayLabel || isInWindow(event, window));
    if (directEvents.length > 0) {
      return directEvents;
    }
  } catch {
    // The NGA calendar is Cloudflare-protected in some server contexts; use the public DC listing fallback below.
  }

  const fallbackEvents = parseWashingtonOrgCards(await fetchText(NGA_WASHINGTON_ORG_URL), window)
    .filter((event) => (
      /\bnational gallery of art\b|\bnga\b/i.test([
        event.title,
        event.venue,
        event.address,
        event.description,
        event.url,
      ].join(' '))
    ))
    .map((event) => ({
      ...event,
      venue: event.venue || 'National Gallery of Art',
      source: 'NGA Calendar',
    }));

  return fallbackEvents.length > 0 ? fallbackEvents : buildNgaIndexedFallbackEvents(window);
};

const fetchSmithsonianEvents = async () => {
  const response = await fetch(SMITHSONIAN_TRUMBA_URL, {
    headers: { 'User-Agent': 'event-tinder/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = await response.json();
  return (Array.isArray(payload) ? payload : [])
    .filter(isRelevantSmithsonianEvent)
    .map(normalizeSmithsonianEvent);
};

export const getTodayDcEvents = async ({ date, phase = 'full' } = {}) => {
  const now = Date.now();
  const dateLabel = normalizeDateLabel(date);
  const normalizedPhase = phase === 'fast' ? 'fast' : 'full';
  const cacheKey = `${dateLabel ?? 'today'}:${normalizedPhase}`;
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
  const eventSources = buildEventSources(window)
    .filter((source) => normalizedPhase === 'full' || source.phase === 'fast');
  const sourceResults = await Promise.all(
    eventSources.map(({ source, fetcher }) => (
      runSource(source, fetcher, normalizedPhase === 'fast' ? 6000 : null)
    )),
  );

  const filteredSourceResults = sourceResults.map((source) => ({
    ...source,
    events: source.events.filter((event) => isInWindow(event, window)),
  }));

  const events = sortEvents(dedupeEvents(filteredSourceResults.flatMap((source) => source.events)));

  const payload = {
    events,
    meta: {
      count: events.length,
      city: 'Washington, DC',
      timeZone: DC_TIME_ZONE,
      rangeStart: window.now.toISOString(),
      rangeEnd: window.end.toISOString(),
      today: window.todayLabel,
      cached: false,
      phase: normalizedPhase,
      sourceStatus: filteredSourceResults.map(({ source, status, events: sourceEvents }) => ({
        source,
        status,
        count: sourceEvents.length,
      })),
    },
  };

  cache.set(cacheKey, { createdAt: now, payload });
  return payload;
};
