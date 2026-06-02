# Today in DC

A Vite + React app with an Express scraper API for events happening today in Washington, DC. The home page shows the real event feed as swipe cards. `/today-dc` shows the same feed in list mode.

## Quick start

1. Use Node.js 18 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file from `.env.example`. Ticketmaster and Eventbrite keys are optional; public scraper sources work without them.
4. Run the app:

   ```bash
   npm run dev
   ```

The frontend runs on Vite and proxies API calls to the Express server.

## API

`GET /api/today-dc-events` returns the current Today DC event payload, source statuses, and cached scrape metadata.

## Build

```bash
npm run build
```
