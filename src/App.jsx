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
  const [showAgent, setShowAgent] = useState(false);
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
          <h1 className="app__title">What are you doing today?</h1>
          <label className="app__label app__label--hidden" htmlFor="search-input">
            Describe the events you want to find
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
            {/* make work */}
            <button
              className="app__button button button--primary"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>
        <EventSwipe events={eventsForDeck} isLoading={loading} />
 
      <section class="agent-response">
      <button
        className="app__toggle app__toggle--primary"
        type="button"
        onClick={() => setShowAgent((prev) => !prev)}
      >
        {showAgent ? 'Hide agent response' : 'Show agent response'}
      </button>
      {showAgent ? (
        <section className="app__agent">
          {activeQuery && (
            <p className="app__agent-meta">
              Showing results for: <strong>{activeQuery}</strong>
            </p>
          )}
          {loading && <p className="app__agent-status">Loading…</p>}
          {error && (
            <p className="app__agent-error">
              Error fetching data: {error}
            </p>
          )}
          {data && (
            <pre className="app__agent-output">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </section>
      ) : null}
      </section>
    </main>
  );
};

export default App;
