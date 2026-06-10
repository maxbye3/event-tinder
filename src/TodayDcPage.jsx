import { useEffect, useMemo, useState } from 'react';

const FALLBACK_IMAGES = {
  book: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80',
  music: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80',
  museum: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  outdoors: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
  tech: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  political: 'https://images.unsplash.com/photo-1540783797630-447cd0f3eb3d?auto=format&fit=crop&w=1200&q=80',
  sports: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  other: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80',
};

const fallbackImageFor = (type) => FALLBACK_IMAGES[type] ?? FALLBACK_IMAGES.other;

const UNSPLASH_HOSTS = new Set([
  'images.unsplash.com',
  'plus.unsplash.com',
  'source.unsplash.com',
]);

const ITINERARY_STORAGE_KEY = 'event-tinder-itinerary';
const SELECTED_DATE_STORAGE_KEY = 'event-tinder-selected-date';

const CITY_CONFIGS = {
  dc: {
    key: 'dc',
    edition: 'DC Edition',
    apiPath: '/api/today-dc-events',
    homePath: '/',
    timeZone: 'America/New_York',
  },
  london: {
    key: 'london',
    edition: 'London Edition',
    apiPath: '/api/today-london-events',
    homePath: '/london',
    timeZone: 'Europe/London',
  },
};

const toOptionalString = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildEventKey = (event) => [
  toOptionalString(event?.title) ?? 'saved event',
  toOptionalString(event?.date) ?? '',
  toOptionalString(event?.time) ?? '',
  toOptionalString(event?.venue) ?? '',
]
  .map((part) => part.toLowerCase())
  .join('::');

const mergeEvents = (existingEvents, incomingEvents) => {
  const merged = [];
  const seen = new Set();

  [...existingEvents, ...incomingEvents].forEach((event) => {
    const key = buildEventKey(event);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(event);
  });

  return merged;
};

const readItineraryFromStorage = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(ITINERARY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeItineraryToStorage = (items) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(items));
};

const sanitizeEventForStorage = (event, safeImage) => ({
  title: toOptionalString(event?.title) ?? 'Saved event',
  date: toOptionalString(event?.date),
  time: toOptionalString(event?.time),
  venue: toOptionalString(event?.venue),
  address: toOptionalString(event?.address),
  description: toOptionalString(event?.description),
  url: toOptionalString(event?.url),
  type: toOptionalString(event?.type),
  image: toOptionalString(safeImage),
});

const hasRetrievedImage = (event) => {
  if (typeof event?.image !== 'string') {
    return false;
  }

  try {
    const { protocol, hostname } = new URL(event.image);
    return (protocol === 'http:' || protocol === 'https:') && !UNSPLASH_HOSTS.has(hostname);
  } catch {
    return false;
  }
};

const CHILD_AUDIENCE_PATTERN = /\b(children|child|kids|kid|family|families|toddler|toddlers|preschool|youth|teen|teens|storytime|story time|all ages|all-ages|babies|baby)\b/i;
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

const childAudienceRank = (event) => {
  const searchableText = [
    event?.title,
    event?.type,
    event?.description,
    event?.venue,
    event?.source,
  ].filter(Boolean).join(' ');

  return CHILD_AUDIENCE_PATTERN.test(searchableText) ? 1 : 0;
};

const priceRank = (event) => /\bfree\b/i.test([event?.time, event?.description].filter(Boolean).join(' ')) ? 0 : 1;
const recurringRank = (event) => /\b(various dates|ongoing|regular|daily|weekly|permanent)\b/i
  .test([event?.time, event?.description].filter(Boolean).join(' ')) ? 1 : 0;
const evergreenGuideRank = (event) => {
  const haystack = [event?.title, event?.time, event?.description, event?.venue, event?.source].filter(Boolean).join(' ');
  if (!/\b(Time Out London|Fever|Secret London|The Nudge|Atlas Obscura)\b/i.test(event?.source ?? '')) return 0;
  return /\b(bucket list|best things to do|things to do in \w+|best of|best \w+|where to watch|on a budget|bike rides|free museums|guide|guides|events in \w+|what'?s on this \w+|attractions|ideas)\b/i.test(haystack)
    ? 1
    : 0;
};
const sourceRank = (event) => {
  const sources = String(event?.source ?? '').split(/\s+\+\s+/).filter(Boolean);
  const ranks = sources.map((source) => SOURCE_PRIORITY_MAP.get(source) ?? SOURCE_PRIORITY.length);
  return ranks.length ? Math.min(...ranks) : SOURCE_PRIORITY.length;
};
const sourceKey = (event) => String(event?.source ?? '').split(/\s+\+\s+/).filter(Boolean)[0] || 'Other';

const sortEventsBase = (events) => [...events].sort((a, b) => {
  const audienceRank = childAudienceRank(a) - childAudienceRank(b);
  if (audienceRank !== 0) return audienceRank;

  const evergreenRank = evergreenGuideRank(a) - evergreenGuideRank(b);
  if (evergreenRank !== 0) return evergreenRank;

  const freeRank = priceRank(a) - priceRank(b);
  if (freeRank !== 0) return freeRank;

  const oneOffRank = recurringRank(a) - recurringRank(b);
  if (oneOffRank !== 0) return oneOffRank;

  const imageRank = Number(hasRetrievedImage(b)) - Number(hasRetrievedImage(a));
  if (imageRank !== 0) return imageRank;

  const sourcePriorityRank = sourceRank(a) - sourceRank(b);
  if (sourcePriorityRank !== 0) return sourcePriorityRank;

  const left = a?.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  const right = b?.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  return left - right;
});

const interleaveSources = (events) => {
  const buckets = new Map();
  for (const event of events) {
    const key = sourceKey(event);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(event);
  }

  const orderedKeys = [...buckets.keys()].sort((left, right) => (
    sourceRank(buckets.get(left)[0]) - sourceRank(buckets.get(right)[0])
  ));
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
  Number(!hasRetrievedImage(event)),
  evergreenGuideRank(event),
].join(':');

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

const sortEventsForDisplay = (events) => {
  const sorted = sortEventsBase(events);
  const groups = new Map();

  for (const event of sorted) {
    const key = qualityGroupKey(event);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }

  return softenSourceRuns([...groups.values()].flatMap(interleaveSources));
};

const getDateValue = (timeZone = 'America/New_York') => {
  const values = {};
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  for (const part of formatter.formatToParts(new Date())) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
};

const readSelectedDateFromStorage = (timeZone = 'America/New_York', cityKey = 'dc') => {
  if (typeof window === 'undefined') {
    return getDateValue(timeZone);
  }

  try {
    const today = getDateValue(timeZone);
    const storedDate = window.localStorage.getItem(`${SELECTED_DATE_STORAGE_KEY}:${cityKey}`)
      ?? window.localStorage.getItem(SELECTED_DATE_STORAGE_KEY);
    return storedDate && storedDate >= today ? storedDate : today;
  } catch {
    return getDateValue(timeZone);
  }
};

const formatDateChoice = (dateValue) => {
  const [year, month, day] = dateValue.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
};

const TodayDcPage = ({ city = 'dc' }) => {
  const cityConfig = CITY_CONFIGS[city] ?? CITY_CONFIGS.dc;
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => readSelectedDateFromStorage(cityConfig.timeZone, cityConfig.key));
  const [itinerary, setItinerary] = useState(readItineraryFromStorage);

  useEffect(() => {
    const fastController = new AbortController();
    const fullController = new AbortController();

    setLoading(true);
    setError(null);
    setPayload(null);

    const buildUrl = (phase) => {
      const params = new URLSearchParams({ date: selectedDate, phase });
      return `${cityConfig.apiPath}?${params}`;
    };

    const loadPayload = (phase, signal) => fetch(buildUrl(phase), { signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
      });

    loadPayload('fast', fastController.signal)
      .then((json) => {
        setPayload((currentPayload) => (
          currentPayload?.meta?.phase === 'full' ? currentPayload : json
        ));
        if (Array.isArray(json.events) && json.events.length > 0) {
          setLoading(false);
        }
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message);
          setLoading(false);
        }
      });

    loadPayload('full', fullController.signal)
      .then((json) => {
        setPayload((currentPayload) => {
          if (!currentPayload) {
            return json;
          }

          const events = mergeEvents(
            Array.isArray(currentPayload.events) ? currentPayload.events : [],
            Array.isArray(json.events) ? json.events : [],
          );

          return {
            ...json,
            events,
            meta: {
              ...json.meta,
              count: events.length,
            },
          };
        });
        setLoading(false);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setError((currentError) => currentError ?? requestError.message);
          setLoading(false);
        }
      });

    return () => {
      fastController.abort();
      fullController.abort();
    };
  }, [cityConfig.apiPath, selectedDate]);

  useEffect(() => {
    try {
      window.localStorage.setItem(`${SELECTED_DATE_STORAGE_KEY}:${cityConfig.key}`, selectedDate);
    } catch {
      // Ignore storage failures; the selected date still works for this session.
    }
  }, [cityConfig.key, selectedDate]);

  const events = useMemo(() => (
    sortEventsForDisplay(Array.isArray(payload?.events) ? payload.events : [])
  ), [payload]);

  const itineraryKeys = useMemo(() => (
    new Set(itinerary.map((item) => buildEventKey(item)))
  ), [itinerary]);

  const addToItinerary = (event) => {
    const safeImage = event.image || fallbackImageFor(event.type);
    const sanitized = sanitizeEventForStorage(event, safeImage);
    const keyToAdd = buildEventKey(sanitized);

    if (itineraryKeys.has(keyToAdd)) {
      return;
    }

    const nextItinerary = [
      ...itinerary,
      {
        ...sanitized,
        savedAt: new Date().toISOString(),
      },
    ];
    writeItineraryToStorage(nextItinerary);
    setItinerary(nextItinerary);
  };

  return (
    <main className="today-page">
      <header className="today-page__header">
        <div>
          <a className="today-page__back" href={cityConfig.homePath}>Back</a>
          <h1>
            Event Tinder <span>{cityConfig.edition}</span>
          </h1>
          <div className="today-page__controls">
            <label className="today-page__day-picker">
              <span>
                <small>Choose day</small>
                <strong>{formatDateChoice(selectedDate)}</strong>
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                aria-label="Choose event date"
              />
            </label>
            <button
              className="today-page__itinerary-button"
              type="button"
              disabled={itinerary.length === 0}
              onClick={() => {
                window.location.href = '/itinerary';
              }}
            >
              See itinerary
            </button>
          </div>
        </div>
      </header>

      {error ? <p className="today-page__error">{error}</p> : null}

      {!error && !loading && events.length === 0 ? (
        <section className="today-page__empty">
          <h2>No events loaded yet</h2>
          <p>No events came back from the free public sources. Ticketmaster and Eventbrite can be added with free keys.</p>
        </section>
      ) : null}

      <section className="today-page__list" aria-label="Events happening today in DC">
        {loading ? (
          <p className="today-page__status">Finding events...</p>
        ) : events.map((event) => (
          <article className="today-event" key={`${event.title}-${event.venue}-${event.date}-${event.time}`}>
            <img
              className="today-event__image"
              src={event.image || fallbackImageFor(event.type)}
              alt=""
              loading="lazy"
              onError={(imageEvent) => {
                const fallback = fallbackImageFor(event.type);
                if (imageEvent.currentTarget.src !== fallback) {
                  imageEvent.currentTarget.src = fallback;
                }
              }}
            />
            <div className="today-event__body">
              <div className="today-event__meta">
                <span>{event.time ?? 'TBA'}</span>
                <span>{event.type ?? 'event'}</span>
                {event.source ? <span>{event.source}</span> : null}
              </div>
              <h2>{event.title}</h2>
              <p className="today-event__venue">
                <strong>{event.venue ?? 'Venue TBA'}</strong>
                {event.address ? `, ${event.address}` : ''}
              </p>
              {event.description ? <p className="today-event__description">{event.description}</p> : null}
              <div className="today-event__actions">
                <button
                  className="today-event__add"
                  type="button"
                  disabled={itineraryKeys.has(buildEventKey(event))}
                  onClick={() => addToItinerary(event)}
                >
                  {itineraryKeys.has(buildEventKey(event)) ? 'In itinerary' : 'Add to itinerary'}
                </button>
                {event.url ? (
                  <a className="today-event__link" href={event.url} target="_blank" rel="noreferrer">
                    Details
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>

      {cityConfig.key === 'london' ? (
        <section className="today-page__source-priority" aria-label="London source priority">
          <h2>Source priority</h2>
          <ol>
            {SOURCE_PRIORITY.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
};

export default TodayDcPage;
