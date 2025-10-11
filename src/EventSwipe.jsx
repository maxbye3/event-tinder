import { useEffect, useMemo, useState } from 'react';
import TinderCard from 'react-tinder-card';

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

    const safeImage =
      typeof image === 'string' && image.length > 0
        ? image
        : 'https://source.unsplash.com/featured/?washington-dc,events';
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
