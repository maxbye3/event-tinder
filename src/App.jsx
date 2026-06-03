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

const sortEventsForDisplay = (events) => [...events].sort((a, b) => {
  const imageRank = Number(hasRetrievedImage(b)) - Number(hasRetrievedImage(a));
  if (imageRank !== 0) return imageRank;

  const left = a?.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  const right = b?.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  return left - right;
});

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

const App = () => {
  if (window.location.pathname === '/today-dc') {
    return <TodayDcPage />;
  }

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
    sortEventsForDisplay(Array.isArray(payload?.events) ? payload.events : [])
  ), [payload]);

  return (
    <main className="app app--today">
      <header className="app__home-header">
        <div>
          <h1 className="app__title">Today in DC</h1>
          <p className="app__subtitle">{formatRange(payload?.meta)}</p>
        </div>
        <div className="app__home-actions">
          <a className="app__mode-link" href="/today-dc">
            List mode
          </a>
          <button
            className="app__refresh"
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            {loading ? 'Loading' : 'Refresh'}
          </button>
        </div>
      </header>

      {error ? <p className="app__error">{error}</p> : null}

      <EventSwipe events={events} isLoading={loading} />
    </main>
  );
};

export default App;
