import { useEffect, useMemo, useRef, useState } from 'react';
import TinderCard from 'react-tinder-card';
import './styles/event-card.css';

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1200&q=80';

const TECH_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=1420',
  'https://plus.unsplash.com/premium_photo-1681399975135-252eab5fd2db?auto=format&fit=crop&q=80&w=1374',
  'https://plus.unsplash.com/premium_photo-1661963874418-df1110ee39c1?auto=format&fit=crop&q=80&w=1386',
  'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&q=80&w=1472',
  'https://images.unsplash.com/photo-1504384764586-bb4cdc1707b0?auto=format&fit=crop&q=80&w=1470',
];

const OUTDOOR_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1493244040629-496f6d136cc6?auto=format&fit=crop&w=1200&q=80',
];

const TYPE_IMAGE_MAP = {
  tech: TECH_FALLBACK_IMAGES[0],
  museum: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  outdoors: OUTDOOR_FALLBACK_IMAGES[0],
  political: 'https://images.unsplash.com/photo-1540783797630-447cd0f3eb3d?auto=format&fit=crop&w=1200&q=80',
  music: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80',
  sports: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  other: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80',
};

const TRUSTED_UNSPLASH_HOSTS = new Set([
  'images.unsplash.com',
  'plus.unsplash.com',
  'source.unsplash.com',
]);

const ITINERARY_STORAGE_KEY = 'event-tinder-itinerary';
const MAX_RENDERED_CARDS = 3;

const toOptionalString = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildEventKey = (event) => {
  const parts = [
    toOptionalString(event?.title) ?? 'saved event',
    toOptionalString(event?.date) ?? '',
    toOptionalString(event?.time) ?? '',
    toOptionalString(event?.venue) ?? '',
  ];
  return parts
    .map((part) => part.toLowerCase())
    .join('::');
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
  } catch (error) {
    console.warn('Failed to read itinerary from storage', error);
    return [];
  }
};

const writeItineraryToStorage = (items) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to write itinerary to storage', error);
  }
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

const addEventToItinerary = (event, safeImage) => {
  if (typeof window === 'undefined') {
    return [];
  }

  const sanitized = sanitizeEventForStorage(event, safeImage);
  const keyToAdd = buildEventKey(sanitized);
  const existing = readItineraryFromStorage();

  if (existing.some((stored) => buildEventKey(stored) === keyToAdd)) {
    return existing;
  }

  existing.push({
    ...sanitized,
    savedAt: new Date().toISOString(),
  });
  writeItineraryToStorage(existing);
  return existing;
};

const normalizeType = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const hashString = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const pickFromArray = (items, seed) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const index = seed % items.length;
  return items[index];
};

const selectFallbackImage = (event) => {
  const normalized = normalizeType(event?.type);
  const seed = hashString(event?.title ?? '');

  if (normalized === 'tech') {
    return pickFromArray(TECH_FALLBACK_IMAGES, seed) ?? DEFAULT_FALLBACK_IMAGE;
  }

  if (normalized === 'outdoors') {
    return pickFromArray(OUTDOOR_FALLBACK_IMAGES, seed) ?? DEFAULT_FALLBACK_IMAGE;
  }

  if (normalized && TYPE_IMAGE_MAP[normalized]) {
    return TYPE_IMAGE_MAP[normalized];
  }

  return DEFAULT_FALLBACK_IMAGE;
};

const isValidImageUrl = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  try {
    const { protocol, hostname } = new URL(value);
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }
    if (hostname.endsWith('unsplash.com') && !TRUSTED_UNSPLASH_HOSTS.has(hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const EventSwipe = ({ events, isLoading, feedKey, onItineraryChange, onRejectEvent }) => {
  const [lastSwipe, setLastSwipe] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const pendingItineraryRef = useRef(null);
  const previousItemKeysRef = useRef([]);
  const itinerarySyncTimeoutRef = useRef(null);
  const eventVariantMapRef = useRef(new Map());
  const nextVariantIndexRef = useRef(0);
  const nextToastIdRef = useRef(0);

  const items = useMemo(() => {
    if (!Array.isArray(events)) {
      return [];
    }
    return events;
  }, [events]);

  useEffect(() => {
    for (const event of items) {
      const key = buildEventKey(event);
      if (!eventVariantMapRef.current.has(key)) {
        eventVariantMapRef.current.set(key, nextVariantIndexRef.current);
        nextVariantIndexRef.current += 1;
      }
    }
  }, [items]);

  useEffect(() => {
    const previousKeys = previousItemKeysRef.current;
    const currentKeys = items.map((event) => buildEventKey(event));

    if (previousKeys.length > 0 && activeIndex > 0) {
      const currentKeySet = new Set(currentKeys);
      const removedBeforeActiveIndex = previousKeys
        .slice(0, activeIndex)
        .filter((key) => !currentKeySet.has(key))
        .length;

      if (removedBeforeActiveIndex > 0) {
        setActiveIndex((currentIndex) => Math.max(0, currentIndex - removedBeforeActiveIndex));
      }
    }

    previousItemKeysRef.current = currentKeys;
  }, [activeIndex, items]);

  const hasEvents = items.length > 0;
  const activeEvent = hasEvents && activeIndex < items.length ? items[activeIndex] : null;
  const visibleItems = useMemo(() => (
    items
      .slice(activeIndex, activeIndex + MAX_RENDERED_CARDS)
      .map((event, visibleIndex) => ({
        event,
        originalIndex: activeIndex + visibleIndex,
        visibleIndex,
      }))
  ), [activeIndex, items]);

  useEffect(() => {
    setLastSwipe(null);
    setActiveIndex(0);
    eventVariantMapRef.current = new Map();
    nextVariantIndexRef.current = 0;
  }, [feedKey]);

  useEffect(() => {
    if (!lastSwipe) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setLastSwipe(null);
    }, 2800);

    return () => window.clearTimeout(timeout);
  }, [lastSwipe]);

  useEffect(() => () => {
    if (itinerarySyncTimeoutRef.current) {
      window.clearTimeout(itinerarySyncTimeoutRef.current);
    }
  }, []);

  const renderCard = ({ event, originalIndex, visibleIndex }) => {
    const {
      title,
      image,
      venue,
      date,
      time,
      type,
      description,
      url,
      address,
    } = event;

    const safeImage = isValidImageUrl(image)
      ? image
      : selectFallbackImage(event);
    const hasOriginalImage = isValidImageUrl(image);
    const typeLabel = typeof type === 'string' && type.length > 0 ? type : 'event';

    const translateX = 0;
    const translateY = visibleIndex * 8;
    const scale = 1 - visibleIndex * 0.035;
    const variantIndex = eventVariantMapRef.current.get(buildEventKey(event)) ?? originalIndex;

    const handleSwipe = (direction) => {
      nextToastIdRef.current += 1;
      setLastSwipe({ id: nextToastIdRef.current, direction, title });
      if (direction === 'right') {
        const itinerary = addEventToItinerary(event, safeImage);
        pendingItineraryRef.current = itinerary;
      } else if (direction === 'left') {
        onRejectEvent?.(event);
      }
    };

    const handleCardLeftScreen = () => {
      setActiveIndex((currentIndex) => Math.max(currentIndex, originalIndex + 1));
      if (pendingItineraryRef.current) {
        const itinerary = pendingItineraryRef.current;
        pendingItineraryRef.current = null;
        itinerarySyncTimeoutRef.current = window.setTimeout(() => {
          onItineraryChange?.(itinerary);
          itinerarySyncTimeoutRef.current = null;
        }, 220);
      }
    };

    return (
      <TinderCard
        className="swipe"
        key={`${title}-${date}-${originalIndex}`}
        onSwipe={handleSwipe}
        onCardLeftScreen={handleCardLeftScreen}
        preventSwipe={['up', 'down']}
      >
        <div
          className="event-card-wrapper"
          style={{
            zIndex: MAX_RENDERED_CARDS - visibleIndex,
            transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
          }}
        >
          <article className={`event-card ${variantIndex % 2 === 0 ? 'event-card--primary' : 'event-card--secondary'}`}>
            <div
              className={`event-card__image ${hasOriginalImage ? '' : 'event-card__image--placeholder'}`}
              style={{
                backgroundImage: hasOriginalImage
                  ? `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25)), url(${safeImage})`
                  : undefined,
              }}
            >
              {!hasOriginalImage ? (
                <div className="event-card__placeholder-copy">
                  <strong>DC event</strong>
                  <span>{typeLabel}</span>
                </div>
              ) : null}
              <span className="event-card__type">{typeLabel}</span>
            </div>
            <div className="event-card__body">
              <header className="event-card__header">
                <h2>{title}</h2>
                <p className="event-card__meta">
                  <span>{date ?? 'TBA'}</span>
                  {time ? <span>• {time}</span> : null}
                </p>
              </header>
              <p className="event-card__venue">
                <strong>{venue ?? 'Venue TBA'}</strong>
                <br />
                <span>{address ?? ''}</span>
              </p>
            
              {description ? <p className="event-card__description">{description}</p> : null}
            </div>
          </article>
        </div>
      </TinderCard>
    );
  };

  return (
    <section className="swipe-section">
      {lastSwipe && (
        <p
          key={lastSwipe.id}
          className={`swipe-section__info swipe-section__info--${lastSwipe.direction}`}
          role="status"
          aria-live="polite"
        >
          {lastSwipe.direction === 'left' ? (
            <>
              <strong>{lastSwipe.title}</strong> is not your thing...
            </>
          ) : lastSwipe.direction === 'right' ? (
            <>
              <strong>{lastSwipe.title}</strong> has been added to your{' '}
              <a className="swipe-section__link" href="/itinerary">
                itinerary
              </a>
            </>
          ) : (
            <>
              You swiped {lastSwipe.direction} on <strong>{lastSwipe.title}</strong>
            </>
          )}
        </p>
      )}
      <div className="swipe-container">
        {hasEvents && activeIndex < items.length ? (
          <div className="swipe-hints" aria-hidden="true">
            <div className="swipe-hints__item swipe-hints__item--left">
              <svg viewBox="0 0 120 92">
                <path d="M28 14c34 2 62 20 70 45 4 13-2 24-16 25-24 2-49-11-65-29" />
                <path d="M43 36L15 54l22 27" />
              </svg>
              <span>Nope</span>
            </div>
            <div className="swipe-hints__item swipe-hints__item--right">
              <svg viewBox="0 0 120 92">
                <path d="M92 14C58 16 30 34 22 59c-4 13 2 24 16 25 24 2 49-11 65-29" />
                <path d="M77 36l28 18-22 27" />
              </svg>
              <span>Interested</span>
            </div>
          </div>
        ) : null}
        {hasEvents && activeIndex < items.length ? [...visibleItems].reverse().map(renderCard) : (
          <div className="event-card event-card--empty">
            <p>{isLoading ? 'Fetching events…' : 'No events to show yet. Try a new search.'}</p>
          </div>
        )}
        {activeEvent?.url ? (
          <a
            className="event-card__link swipe-container__details"
            href={activeEvent.url}
            target="_blank"
            rel="noreferrer"
          >
            VIEW DETAILS
          </a>
        ) : null}
      </div>

    </section>
  );
};

export default EventSwipe;
