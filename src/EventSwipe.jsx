import { useEffect, useMemo, useState } from 'react';
import TinderCard from 'react-tinder-card';

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

const EventSwipe = ({ events, isLoading }) => {
  const [lastSwipe, setLastSwipe] = useState(null);

  const items = useMemo(() => {
    if (!Array.isArray(events)) {
      return [];
    }
    return events;
  }, [events]);

  const hasEvents = items.length > 0;

  useEffect(() => {
    setLastSwipe(null);
  }, [events]);

  const renderCard = (event, index) => {
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
    const typeLabel = typeof type === 'string' && type.length > 0 ? type : 'event';

    return (
      <TinderCard
        className="swipe"
        key={`${title}-${date}-${index}`}
        onSwipe={(direction) => setLastSwipe({ direction, title })}
        preventSwipe={['up', 'down']}
      >
        <article className="event-card" style={{ zIndex: items.length - index }}>
          <div
            className="event-card__image"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25)), url(${safeImage})`,
            }}
          >
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
            {url ? (
              <a className="event-card__link" href={url} target="_blank" rel="noreferrer">
                View details
              </a>
            ) : null}
          </div>
        </article>
      </TinderCard>
    );
  };

  return (
    <section className="swipe-section">
      <h2 className="swipe-section__title">Swipe through upcoming picks</h2>
      <div className="swipe-container">
        {hasEvents ? items.map(renderCard) : (
          <div className="event-card event-card--empty">
            <p>{isLoading ? 'Fetching events…' : 'No events to show yet. Try a new search.'}</p>
          </div>
        )}
      </div>
      {lastSwipe && (
        <p className="swipe-section__info">
          You swiped {lastSwipe.direction} on <strong>{lastSwipe.title}</strong>
        </p>
      )}
    </section>
  );
};

export default EventSwipe;
