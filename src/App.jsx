import { useEffect, useRef, useState } from 'react';
import EventSwipe from './EventSwipe';
import { createSampleData } from './sampleData';

const DEFAULT_QUERY = 'tech events in Washington, DC happening this week';

const fetchAgentResponse = async ({ signal, query }) => {
  const params = query ? `?q=${encodeURIComponent(query)}` : '';
  const res = await fetch(`/api/agent-response${params}`, { signal });
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json();
};

const App = () => {
  const [sampleData] = useState(() => createSampleData());
  const [data, setData] = useState(sampleData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState(DEFAULT_QUERY);
  const [activeQuery, setActiveQuery] = useState('');
  const requestController = useRef(null);

  const startFetch = (query) => {
    const base = typeof query === 'string' ? query : '';
    const trimmed = base.trim();
    const nextQuery = trimmed.length > 0 ? trimmed : DEFAULT_QUERY;

    if (requestController.current) {
      requestController.current.abort();
    }

    const controller = new AbortController();
    requestController.current = controller;

    setLoading(true);
    setError(null);
    setActiveQuery(nextQuery);
    setData(nextQuery === DEFAULT_QUERY ? sampleData : null);

    fetchAgentResponse({ signal: controller.signal, query: nextQuery })
      .then((json) => {
        setData(json);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      })
      .finally(() => {
        if (requestController.current === controller) {
          requestController.current = null;
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    return () => {
      if (requestController.current) {
        requestController.current.abort();
      }
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    startFetch(inputValue);
  };

  useEffect(() => {
    if (data) {
      console.log('Agent response:', activeQuery, data);
    }
  }, [data, activeQuery]);

  useEffect(() => {
    if (error) {
      console.error('Failed to fetch agent response:', error);
    }
  }, [error]);

  const eventsForDeck = activeQuery
    ? (Array.isArray(data?.events) ? data.events : [])
    : sampleData.events;

  return (
    <main className="app">
      <form className="app__form" onSubmit={handleSubmit}>
        <label className="app__label" htmlFor="search-input">
          Describe the events you want to find:
        </label>
        <div className="app__controls">
          <input
            className="app__input"
            id="search-input"
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="e.g. free outdoor concerts in DC this weekend"
          />
          <button
            className="app__button"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>
      <EventSwipe events={eventsForDeck} isLoading={loading} />
      <h1>Agent Response</h1>
      {!activeQuery && data && (
        <p style={{ marginTop: 0, marginBottom: '1rem', color: '#4b5563' }}>
          Showing sample data. Use the search box to fetch live results.
        </p>
      )}
      {activeQuery && (
        <p style={{ marginTop: 0, marginBottom: '1rem', color: '#4b5563' }}>
          Showing results for: <strong>{activeQuery}</strong>
        </p>
      )}
      {loading && <p>Loading…</p>}
      {error && (
        <p style={{ color: '#b91c1c' }}>
          Error fetching data: {error}
        </p>
      )}
      {data && (
        <pre
          style={{
            background: '#111827',
            color: '#f9fafb',
            padding: '1rem',
            borderRadius: '0.75rem',
            whiteSpace: 'pre-wrap',
          }}
        >{JSON.stringify(data, null, 2)}</pre>
      )}
    </main>
  );
};

export default App;
