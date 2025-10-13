import OpenAI from 'openai';
import { aggregateEvents } from './aggregateEvents.js';

const DEFAULT_QUERY = 'events in Washington, DC happening this week';

const createClient = (apiKey) => new OpenAI({ apiKey });

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isHttpUrl = (value) => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const curatedImageCatalog = [
  {
    pattern: /farmers?|market|produce/i,
    url: 'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80',
  },
  {
    pattern: /blockchain|ai|artificial intelligence|tech|startup|developer|innovation/i,
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  },
  {
    pattern: /museum|gallery|exhibit|art/i,
    url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  },
  {
    pattern: /concert|jazz|music|festival|dance|dj|choir/i,
    url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    pattern: /yoga|wellness|meditation|fitness/i,
    url: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80',
  },
  {
    pattern: /cabaret|comedy|theatre|fringe|performance/i,
    url: 'https://images.unsplash.com/photo-1515169067865-5387a796848c?auto=format&fit=crop&w=1200&q=80',
  },
  {
    pattern: /book|author|reading|literary/i,
    url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80',
  },
  {
    pattern: /cleanup|trail|hike|bike|kayak|outdoor|nature|gardening/i,
    url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
  },
  {
    pattern: /sports?|game|match|baseball|basketball|soccer/i,
    url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    pattern: /politic|policy|affairs|forum|civic/i,
    url: 'https://images.unsplash.com/photo-1540783797630-447cd0f3eb3d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    pattern: /market|food|taste|culinary|dinner|wine|beer/i,
    url: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80',
  },
];

const typeImageMap = {
  tech: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  museum: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  outdoors: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
  political: 'https://images.unsplash.com/photo-1540783797630-447cd0f3eb3d?auto=format&fit=crop&w=1200&q=80',
  music: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80',
  sports: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  other: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80',
};

const normalizeType = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const OUTDOOR_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1493244040629-496f6d136cc6?auto=format&fit=crop&w=1200&q=80',
];

const TECH_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=1420',
  'https://plus.unsplash.com/premium_photo-1681399975135-252eab5fd2db?auto=format&fit=crop&q=80&w=1374',
  'https://plus.unsplash.com/premium_photo-1661963874418-df1110ee39c1?auto=format&fit=crop&q=80&w=1386',
  'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&q=80&w=1472',
  'https://images.unsplash.com/photo-1504384764586-bb4cdc1707b0?auto=format&fit=crop&q=80&w=1470',
];

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1200&q=80';

const selectCuratedImage = ({ title, type, term }) => {
  const haystack = [title, term].filter((value) => typeof value === 'string').join(' ').toLowerCase();
  const normalizedType = normalizeType(type);

  for (const { pattern, url } of curatedImageCatalog) {
    if (pattern.test(haystack)) {
      return url;
    }
  }

  if (normalizedType && typeImageMap[normalizedType]) {
    return typeImageMap[normalizedType];
  }

  return null;
};

const extractMetaContent = (html, baseUrl, keys) => {
  for (const key of keys) {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapeForRegex(key)}["'][^>]*>`,
      'i',
    );
    const match = html.match(pattern);
    if (!match) continue;

    const tag = match[0];
    const contentMatch = tag.match(/content=["']([^"']+)["']/i);
    if (!contentMatch) continue;

    const rawUrl = contentMatch[1].trim();

    try {
      const absolute = new URL(rawUrl, baseUrl).toString();
      if (isHttpUrl(absolute)) {
        return absolute;
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return null;
};

const fetchOpenGraphImage = async (targetUrl) => {
  if (!isHttpUrl(targetUrl)) {
    return null;
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'event-tinder/1.0 (+https://example.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      return null;
    }

    const baseUrl = response.url;
    const html = await response.text();
    const snippet = html.slice(0, 200_000);

    return extractMetaContent(snippet, baseUrl, [
      'og:image',
      'og:image:url',
      'twitter:image',
      'twitter:image:src',
    ]);
  } catch (error) {
    console.warn(
      'Failed to fetch OpenGraph image for',
      targetUrl,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
};

const IMAGE_PROBE_HEADERS = {
  'User-Agent': 'event-tinder/1.0 (+https://example.com)',
  Accept: 'image/*',
};

const TRUSTED_IMAGE_HOSTS = new Set(['images.unsplash.com', 'plus.unsplash.com', 'source.unsplash.com']);

const isLikelyBrokenUnsplashUrl = (value) => {
  try {
    const { hostname } = new URL(value);
    return hostname === 'image.unsplash.com';
  } catch {
    return false;
  }
};

const isReachableImageUrl = async (candidate) => {
  if (!isHttpUrl(candidate) || isLikelyBrokenUnsplashUrl(candidate)) {
    return false;
  }

  let hostname;
  try {
    ({ hostname } = new URL(candidate));
  } catch {
    return false;
  }

  if (TRUSTED_IMAGE_HOSTS.has(hostname)) {
    return true;
  }

  try {
    const response = await fetch(candidate, {
      method: 'HEAD',
      headers: IMAGE_PROBE_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(2500),
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      return !contentType || contentType.startsWith('image/');
    }

    if (response.status === 405) {
      // Some CDNs disallow HEAD but permit GET; accept the URL in this case.
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

const resolveCandidateImage = async (candidates) => {
  for (const candidate of candidates) {
    if (!(await isReachableImageUrl(candidate))) {
      continue;
    }
    return candidate;
  }
  return null;
};

export const createAgentResponse = async ({ apiKey, query }) => {
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable.');
  }

  const rawQuery = typeof query === 'string' ? query : '';
  const trimmedQuery = rawQuery.trim();
  const searchTerm = trimmedQuery.length > 0 ? trimmedQuery : 'events in Washington, DC happening this week';
  const sanitizedTerm = searchTerm.replace(/[.?!]+$/, '');
  const userPrompt = `Based on the user request "${sanitizedTerm}", list at least 10 unique, verified events happening in Washington, DC this week that match or closely align with it.`;

  const client = createClient(apiKey);

  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'system',
        content: `You are DC Explorer, a local event data agent for Washington, D.C.
Your goal is to return real, verified events happening in or near a given neighborhood. Always return at least 10 verified events whenever possible.
When the user asks questions such as “What’s happening near me?” or “What events are in Dupont this weekend?”, you must:
Use the Web Search tool to find events from trusted D.C. sources:
Eventbrite
Meetup
Smithsonian Events Calendar
Washington.org
Capital Pride, DC JazzFest, DC.gov Arts, National Gallery, Kennedy Center
Perform multiple searches with different keyword combinations (e.g. “Dupont Circle events October 2025,” “Washington DC weekend events,” “DC concerts,” “museum exhibitions near Dupont”). Keep gathering results until at least 10 unique verified events are found or all reliable sources are exhausted.
Include only verified events whose date, time, and venue are clearly listed on official or trusted sites.
If no verified events are found, return this exact JSON object:
{ "message": "No verified events found near this location." }
Otherwise, return an array of structured JSON objects, each event containing:
[   {     "title": "string",     "type": "string",     "venue": "string",     "address": "string",     "date": "YYYY-MM-DD",     "time": "string",     "description": "string",     "url": "string",     "image": "string"   } ]
"type" must be one of: "tech", "museum", "outdoors", "political", "music", or "other".
Use null for missing fields rather than omitting them.
Do not truncate or summarize — include all 10+ results.
Output format: JSON only — no Markdown, no commentary, no reasoning.`,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    tools: [{ type: 'web_search' }],
    text: {
      format: {
        type: 'json_schema',
        name: 'event_list',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            events: {
              type: 'array',
              additionalProperties: false,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  title: { type: 'string' },
                  type: { type: 'string' },
                  venue: { type: 'string' },
                  address: { type: 'string' },
                  date: { type: 'string' },
                  time: { type: 'string' },
                  description: { type: 'string' },
                  url: { type: 'string' },
                  image: { type: ['string', 'null'] },
                },
                required: [
                  'title',
                  'type',
                  'venue',
                  'address',
                  'date',
                  'time',
                  'description',
                  'url',
                  'image',
                ],
              },
            },
            meta: {
              type: 'object',
              additionalProperties: false,
              properties: {
                count: { type: 'integer' },
              },
              required: ['count'],
            },
          },
          required: ['events', 'meta'],
        },
      },
    },
  });

  const textOutput = response?.output_text;
  let parsedOutput = null;

  if (textOutput) {
    try {
      parsedOutput = JSON.parse(textOutput);
    } catch (parseError) {
      console.warn('Failed to parse OpenAI text output as JSON:', parseError);
    }
  }

  if (!Array.isArray(parsedOutput?.events)) {
    return response;
  }

  const aggregatedEvents = aggregateEvents(parsedOutput.events);

  const eventsWithImages = await Promise.all(
    aggregatedEvents.map(async (event) => {
      let resolvedImage = null;

      if (isHttpUrl(event.url)) {
        resolvedImage = await fetchOpenGraphImage(event.url);
      }

      const curatedImage = selectCuratedImage({
        title: event.title,
        type: event.type,
        term: sanitizedTerm,
      });

      const normalizedType = normalizeType(event.type);

      const fallbackByType = (() => {
        if (normalizedType === 'tech') {
          return TECH_FALLBACK_IMAGES;
        }
        if (normalizedType === 'outdoors') {
          return OUTDOOR_FALLBACK_IMAGES;
        }
        if (normalizedType && typeImageMap[normalizedType]) {
          return [typeImageMap[normalizedType]];
        }
        return [];
      })();

      const rawCandidates = [
        resolvedImage,
        event.image,
        ...(Array.isArray(event.imageCandidates) ? event.imageCandidates : []),
        curatedImage,
        ...fallbackByType,
        DEFAULT_FALLBACK_IMAGE,
      ].filter((value) => typeof value === 'string' && value.length > 0);

      const uniqueCandidates = rawCandidates.filter(
        (src, index) => rawCandidates.indexOf(src) === index,
      );

      const finalImage = await resolveCandidateImage(uniqueCandidates);

      const { imageCandidates, ...rest } = event;

      return {
        ...rest,
        image: finalImage ?? null,
      };
    }),
  );

  return {
    ...parsedOutput,
    events: eventsWithImages,
    meta: {
      ...(parsedOutput.meta ?? {}),
      count: eventsWithImages.length,
    },
  };
};

export const __testing = {
  DEFAULT_FALLBACK_IMAGE,
  selectCuratedImage,
  isHttpUrl,
  fetchOpenGraphImage,
};
