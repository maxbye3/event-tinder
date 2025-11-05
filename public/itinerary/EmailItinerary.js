(function (global) {
  const send = (itineraryItems) => {
    const payload = Array.isArray(itineraryItems) ? itineraryItems : [];
    console.log('EmailItinerary: sending itinerary to email', payload);
  };

  global.EmailItinerary = Object.freeze({
    send,
  });
})(window);
