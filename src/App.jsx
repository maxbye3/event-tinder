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

const CHILD_AUDIENCE_PATTERN = /\b(children|child|kids|kid|family|families|toddler|toddlers|preschool|youth|teen|teens|storytime|story time|all ages|all-ages)\b/i;

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

const sortEventsForDisplay = (events) => [...events].sort((a, b) => {
  const audienceRank = childAudienceRank(a) - childAudienceRank(b);
  if (audienceRank !== 0) return audienceRank;

  const imageRank = Number(hasRetrievedImage(b)) - Number(hasRetrievedImage(a));
  if (imageRank !== 0) return imageRank;

  const left = a?.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  const right = b?.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  return left - right;
});

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

const getDcDateValue = () => {
  const values = {};
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
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
const ADD_EVENT_SUBJECT = 'DC Event Tinder: Add Event';
const ITINERARY_STORAGE_KEY = 'event-tinder-itinerary';
const REJECTED_EVENTS_STORAGE_KEY = 'event-tinder-rejected-events';
const SELECTED_DATE_STORAGE_KEY = 'event-tinder-selected-date';

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

const readSelectedDateFromStorage = () => {
  if (typeof window === 'undefined') {
    return getDcDateValue();
  }

  try {
    const today = getDcDateValue();
    const storedDate = window.localStorage.getItem(SELECTED_DATE_STORAGE_KEY);
    return storedDate && storedDate >= today ? storedDate : today;
  } catch {
    return getDcDateValue();
  }
};

const hasItineraryItemsInStorage = () => {
  return readItineraryFromStorage().length > 0;
};

const App = () => {
  if (window.location.pathname === '/today-dc') {
    return <TodayDcPage />;
  }

  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState(readSelectedDateFromStorage);
  const [itineraryItems, setItineraryItems] = useState(readItineraryFromStorage);
  const [rejectedEventsByDate, setRejectedEventsByDate] = useState(readRejectedEventsFromStorage);
  const [hasItineraryItems, setHasItineraryItems] = useState(hasItineraryItemsInStorage);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [addEventMessage, setAddEventMessage] = useState('');
  const [captcha, setCaptcha] = useState(createCaptcha);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [addEventError, setAddEventError] = useState('');

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

    window.location.href = `mailto:${ADD_EVENT_EMAIL}?subject=${encodeURIComponent(ADD_EVENT_SUBJECT)}&body=${encodeURIComponent(body)}`;
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
      return `/api/today-dc-events?${params}`;
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
  }, [refreshKey, selectedDate]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SELECTED_DATE_STORAGE_KEY, selectedDate);
    } catch {
      // Ignore storage failures; the selected date still works for this session.
    }
  }, [selectedDate]);

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

  const handleItineraryChange = (items) => {
    const nextItems = Array.isArray(items) ? items : [];
    setItineraryItems(nextItems);
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
    <main className="app app--today">
      {showAddEvent ? (
        <section className="swipe-instructions" aria-label="Add an event">
          <div className="swipe-instructions__panel">
            <p className="swipe-instructions__eyebrow">Add event</p>
            <h2>Send us a DC event</h2>
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
            Event Tinder <span>DC Edition</span>
          </h1>
          {hasItineraryItems ? (
            <>
              <a className="app__itinerary-link" href="/itinerary">
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
          <a className="app__mode-link" href="/today-dc">
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
        </div>
      </header>
    </main>
  );
};

export default App;
