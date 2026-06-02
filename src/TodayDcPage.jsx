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

const formatRange = (meta) => {
  if (!meta?.rangeStart || !meta?.rangeEnd) {
    return 'Today until 2:00 AM';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: meta.timeZone ?? 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${formatter.format(new Date(meta.rangeStart))} - ${formatter.format(new Date(meta.rangeEnd))}`;
};

const sourceLabel = (status) => {
  if (status === 'ok') return 'on';
  if (status === 'missing_key') return 'needs key';
  return status ?? 'off';
};

const TodayDcPage = () => {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetch('/api/today-dc-events', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((json) => {
        setPayload(json);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refreshKey]);

  const events = useMemo(() => (
    Array.isArray(payload?.events) ? payload.events : []
  ), [payload]);

  const sourceStatus = Array.isArray(payload?.meta?.sourceStatus)
    ? payload.meta.sourceStatus
    : [];

  return (
    <main className="today-page">
      <header className="today-page__header">
        <div>
          <a className="today-page__back" href="/">Back</a>
          <h1>Today in DC</h1>
          <p>{formatRange(payload?.meta)}</p>
        </div>
        <button
          className="today-page__refresh"
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          {loading ? 'Loading' : 'Refresh'}
        </button>
      </header>

      <section className="today-page__sources" aria-label="Data sources">
        {sourceStatus.map((source) => (
          <span className="today-page__source" key={source.source}>
            {source.source}: {sourceLabel(source.status)}
          </span>
        ))}
      </section>

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
              {event.url ? (
                <a className="today-event__link" href={event.url} target="_blank" rel="noreferrer">
                  Details
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
};

export default TodayDcPage;
