import { useEffect, useMemo, useState } from 'react';
import EventSwipe from './EventSwipe';
import TodayDcPage from './TodayDcPage';

const UNSPLASH_HOSTS = new Set([
  'images.unsplash.com',
  'plus.unsplash.com',
  'source.unsplash.com',
]);

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

const normalizeDedupeText = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/\bw\/\b/g, ' with ')
  .replace(/\bft\.\b/g, ' featuring ')
  .replace(/\bfeat\.\b/g, ' featuring ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b(the|a|an)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const eventKey = (event) => [
  normalizeDedupeText(event?.title),
  String(event?.date ?? '').trim(),
].join('|');

const mergeEvents = (existingEvents, incomingEvents) => {
  const merged = new Map();

  for (const event of existingEvents) {
    merged.set(eventKey(event), event);
  }

  for (const event of incomingEvents) {
    const key = eventKey(event);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, event);
      continue;
    }

    merged.set(key, {
      ...existing,
      ...event,
      image: hasRetrievedImage(existing) && !hasRetrievedImage(event) ? existing.image : event.image,
      venue: existing.venue || event.venue,
      address: existing.address || event.address,
      time: existing.time || event.time,
      startsAt: existing.startsAt || event.startsAt,
      description: (existing.description?.length ?? 0) > (event.description?.length ?? 0)
        ? existing.description
        : event.description,
    });
  }

  return Array.from(merged.values());
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

const ADD_EVENT_EMAIL = 'botherandherobye@gmail.com';
const ITINERARY_STORAGE_KEY = 'event-tinder-itinerary';
const REJECTED_EVENTS_STORAGE_KEY = 'event-tinder-rejected-events';
const SELECTED_DATE_STORAGE_KEY = 'event-tinder-selected-date';
const WELCOME_MODAL_STORAGE_KEY = 'event-tinder-welcome-seen';
const DC_CENTER = { latitude: 38.9072, longitude: -77.0369 };
const DC_NEARBY_RADIUS_KM = 130;

const CITY_CONFIGS = {
  dc: {
    key: 'dc',
    edition: 'DC Edition',
    cityName: 'DC',
    apiPath: '/api/today-dc-events',
    homePath: '/',
    listPath: '/today-dc',
    timeZone: 'America/New_York',
    addEventHeading: 'Send us a DC event',
  },
  london: {
    key: 'london',
    edition: 'London Edition',
    cityName: 'London',
    apiPath: '/api/today-london-events',
    homePath: '/london',
    listPath: '/today-london',
    timeZone: 'Europe/London',
    addEventHeading: 'Send us a London event',
  },
};

const isMumEditionEnabled = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.search.includes('mum-edition');
};

const withMumEditionSearch = (path, isMumEdition) => (
  isMumEdition ? `${path}${path.includes('?') ? '&' : '?'}mum-edition` : path
);

const getDistanceKm = (left, right) => {
  const toRadians = (value) => value * (Math.PI / 180);
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const startLatitude = toRadians(left.latitude);
  const endLatitude = toRadians(right.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const isNearDc = ({ latitude, longitude }) => (
  getDistanceKm({ latitude, longitude }, DC_CENTER) <= DC_NEARBY_RADIUS_KM
);

const inferFallbackCityKey = () => {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone === 'Europe/London') {
      return 'london';
    }
    if (timeZone === 'America/New_York') {
      return 'dc';
    }
  } catch {
    // Fall through to London when browser locale data is unavailable.
  }

  return 'london';
};

const setMumEditionSearch = (enabled) => {
  const nextUrl = new URL(window.location.href);

  if (enabled) {
    nextUrl.searchParams.set('mum-edition', '');
  } else {
    nextUrl.searchParams.delete('mum-edition');
  }

  window.location.href = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
};

const toOptionalString = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildItineraryEventKey = (event) => [
  toOptionalString(event?.title) ?? 'saved event',
  toOptionalString(event?.date) ?? '',
  toOptionalString(event?.time) ?? '',
  toOptionalString(event?.venue) ?? '',
]
  .map((part) => part.toLowerCase())
  .join('::');

const readItineraryFromStorage = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(ITINERARY_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readRejectedEventsFromStorage = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(REJECTED_EVENTS_STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeRejectedEventsToStorage = (itemsByDate) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(REJECTED_EVENTS_STORAGE_KEY, JSON.stringify(itemsByDate));
  } catch {
    // Ignore storage failures; rejected items still work for this session state.
  }
};

const createCaptcha = () => {
  const left = Math.floor(Math.random() * 8) + 2;
  const right = Math.floor(Math.random() * 8) + 2;
  return { left, right, answer: left + right };
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

const hasItineraryItemsInStorage = () => {
  return readItineraryFromStorage().length > 0;
};

const shouldShowWelcomeModal = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(WELCOME_MODAL_STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
};

const App = () => {
  const isMumEdition = isMumEditionEnabled();
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('theme-mum-edition', isMumEdition);
  }

  if (window.location.pathname === '/today-dc') {
    return <TodayDcPage city="dc" isMumEdition={isMumEdition} />;
  }

  if (window.location.pathname === '/today-london') {
    return <TodayDcPage city="london" isMumEdition={isMumEdition} />;
  }

  const [cityKey, setCityKey] = useState(inferFallbackCityKey);
  const cityConfig = CITY_CONFIGS[cityKey];
  const currentSearch = window.location.search;

  if (cityKey === 'london' && window.location.pathname === '/') {
    window.history.replaceState(null, '', `${cityConfig.homePath}${currentSearch}`);
  } else if (cityKey === 'dc' && window.location.pathname === '/london') {
    window.history.replaceState(null, '', `${cityConfig.homePath}${currentSearch}`);
  }

  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => readSelectedDateFromStorage(cityConfig.timeZone, cityConfig.key));
  const [itineraryItems, setItineraryItems] = useState(readItineraryFromStorage);
  const [rejectedEventsByDate, setRejectedEventsByDate] = useState(readRejectedEventsFromStorage);
  const [hasItineraryItems, setHasItineraryItems] = useState(hasItineraryItemsInStorage);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [addEventMessage, setAddEventMessage] = useState('');
  const [captcha, setCaptcha] = useState(createCaptcha);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [addEventError, setAddEventError] = useState('');
  const [showWelcome, setShowWelcome] = useState(shouldShowWelcomeModal);

  useEffect(() => {
    if (!navigator.geolocation) {
      setCityKey(inferFallbackCityKey());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCityKey(isNearDc(coords) ? 'dc' : 'london');
      },
      () => {
        setCityKey(inferFallbackCityKey());
      },
      {
        enableHighAccuracy: false,
        maximumAge: 1000 * 60 * 60 * 12,
        timeout: 5000,
      },
    );
  }, []);

  useEffect(() => {
    if (cityKey === 'london' && window.location.pathname === '/') {
      window.history.replaceState(null, '', `${cityConfig.homePath}${currentSearch}`);
    } else if (cityKey === 'dc' && window.location.pathname === '/london') {
      window.history.replaceState(null, '', `${cityConfig.homePath}${currentSearch}`);
    }
  }, [cityConfig.homePath, cityKey, currentSearch]);

  useEffect(() => {
    setSelectedDate(readSelectedDateFromStorage(cityConfig.timeZone, cityConfig.key));
  }, [cityConfig.key, cityConfig.timeZone]);

  const closeWelcome = () => {
    setShowWelcome(false);
    try {
      window.localStorage.setItem(WELCOME_MODAL_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage failures; the modal will only stay closed for this render.
    }
  };

  const closeAddEvent = () => {
    setShowAddEvent(false);
    setAddEventError('');
  };

  const submitAddEvent = (event) => {
    event.preventDefault();

    const message = addEventMessage.trim();
    if (!message) {
      setAddEventError('Add a few details about the event first.');
      return;
    }

    if (Number(captchaAnswer) !== captcha.answer) {
      setAddEventError('Captcha answer did not match. Try that one more time.');
      setCaptcha(createCaptcha());
      setCaptchaAnswer('');
      return;
    }

    const body = [
      message,
      '',
      `Submitted from: ${window.location.href}`,
    ].join('\n');

    const subject = `${cityConfig.cityName} Event Tinder: Add Event`;
    window.location.href = `mailto:${ADD_EVENT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setShowAddEvent(false);
    setAddEventMessage('');
    setCaptchaAnswer('');
    setCaptcha(createCaptcha());
    setAddEventError('');
  };

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
  }, [cityConfig.apiPath, refreshKey, selectedDate]);

  useEffect(() => {
    try {
      window.localStorage.setItem(`${SELECTED_DATE_STORAGE_KEY}:${cityConfig.key}`, selectedDate);
    } catch {
      // Ignore storage failures; the selected date still works for this session.
    }
  }, [cityConfig.key, selectedDate]);

  useEffect(() => {
    const syncItinerary = () => {
      handleItineraryChange(readItineraryFromStorage());
      setRejectedEventsByDate(readRejectedEventsFromStorage());
    };

    window.addEventListener('focus', syncItinerary);
    window.addEventListener('pageshow', syncItinerary);

    return () => {
      window.removeEventListener('focus', syncItinerary);
      window.removeEventListener('pageshow', syncItinerary);
    };
  }, []);

  const events = useMemo(() => {
    const storedEventKeys = new Set(itineraryItems.map((item) => buildItineraryEventKey(item)));
    const rejectedEventKeys = new Set(
      Array.isArray(rejectedEventsByDate[selectedDate]) ? rejectedEventsByDate[selectedDate] : [],
    );
    const unsavedEvents = (Array.isArray(payload?.events) ? payload.events : [])
      .filter((event) => {
        const key = buildItineraryEventKey(event);
        return !storedEventKeys.has(key) && !rejectedEventKeys.has(key);
      });

    return sortEventsForDisplay(unsavedEvents);
  }, [itineraryItems, payload, rejectedEventsByDate, selectedDate]);

  const handleItineraryChange = (items, options = {}) => {
    const nextItems = Array.isArray(items) ? items : [];
    if (options.syncFilter !== false) {
      setItineraryItems(nextItems);
    }
    setHasItineraryItems(nextItems.length > 0);
  };

  const handleRejectEvent = (event) => {
    const key = buildItineraryEventKey(event);
    const currentItemsByDate = readRejectedEventsFromStorage();
    const existingKeys = Array.isArray(currentItemsByDate[selectedDate])
      ? currentItemsByDate[selectedDate]
      : [];

    if (existingKeys.includes(key)) {
      return;
    }

    writeRejectedEventsToStorage({
      ...currentItemsByDate,
      [selectedDate]: [...existingKeys, key],
    });
  };

  const handleRefresh = () => {
    setRejectedEventsByDate((currentItemsByDate) => {
      const nextItemsByDate = { ...currentItemsByDate };
      delete nextItemsByDate[selectedDate];
      writeRejectedEventsToStorage(nextItemsByDate);
      return nextItemsByDate;
    });
    setRefreshKey((value) => value + 1);
  };

  return (
    <main className={`app app--today ${isMumEdition ? 'app--mum-edition' : ''}`}>
      {showWelcome ? (
        <section className="swipe-instructions" aria-label="Welcome to Event Tinder">
          <div className="swipe-instructions__panel swipe-instructions__panel--welcome">
            <p className="swipe-instructions__eyebrow">Hey there</p>
            <h2>Welcome to Event Tinder</h2>
            <div className="swipe-instructions__copy">
              <p>Instead of singles in your area, we are showing events.</p>
              <p>Swipe right to save an event, left to skip.</p>
              <p>Saved events go into your itinerary below the cards.</p>
              <p>You can change the date or refresh the deck anytime.</p>
            </div>
            <button type="button" onClick={closeWelcome}>
              Got it
            </button>
          </div>
        </section>
      ) : null}

      {showAddEvent ? (
        <section className="swipe-instructions" aria-label="Add an event">
          <div className="swipe-instructions__panel">
            <p className="swipe-instructions__eyebrow">Add event</p>
            <h2>{cityConfig.addEventHeading}</h2>
            <form className="add-event-form" onSubmit={submitAddEvent}>
              <label>
                <span>Event details</span>
                <textarea
                  value={addEventMessage}
                  onChange={(event) => setAddEventMessage(event.target.value)}
                  placeholder="Name, date, time, venue, link, and anything we should know."
                  rows="6"
                />
              </label>
              <label className="add-event-form__captcha">
                <span>{captcha.left} + {captcha.right} = ?</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={captchaAnswer}
                  onChange={(event) => setCaptchaAnswer(event.target.value)}
                  aria-label="Captcha answer"
                />
              </label>
              {addEventError ? <p className="add-event-form__error">{addEventError}</p> : null}
              <div className="add-event-form__actions">
                <button type="button" onClick={closeAddEvent}>
                  Cancel
                </button>
                <button type="submit">
                  Send
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <EventSwipe
        events={events}
        isLoading={loading}
        feedKey={`${selectedDate}:${refreshKey}`}
        onItineraryChange={handleItineraryChange}
        onRejectEvent={handleRejectEvent}
      />

      {error ? <p className="app__error">{error}</p> : null}

      <header className="app__home-header">
        <div>
          <h1 className="app__title">
            Event Tinder <span>{cityConfig.edition}</span>
          </h1>
          {hasItineraryItems ? (
            <>
              <a className="app__itinerary-link" href={withMumEditionSearch('/itinerary', isMumEdition)}>
                Go to itinerary
              </a>
              <div className="app__itinerary-divider" aria-hidden="true" />
            </>
          ) : null}
        </div>
        <div className="app__home-actions">
          <label className="app__day-picker">
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
          <a className="app__mode-link" href={withMumEditionSearch(cityConfig.listPath, isMumEdition)}>
            List mode
          </a>
          <button
            className="app__refresh"
            type="button"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Loading' : 'Refresh'}
          </button>
          <button
            className="app__instructions-button"
            type="button"
            onClick={() => setShowAddEvent(true)}
          >
            Add event
          </button>
          <button
            className="app__theme-toggle"
            type="button"
            onClick={() => setMumEditionSearch(!isMumEdition)}
          >
            {isMumEdition ? 'Regular edition' : 'Mum edition'}
          </button>
        </div>
      </header>
    </main>
  );
};

export default App;
