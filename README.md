# Agent Response Viewer

A minimal Vite + React app with a tiny Express proxy that prints the JSON response from an OpenAI Responses API call using the official SDK.

## Quick start

1. Ensure you are running Node.js 18 or newer (for the built-in `fetch`).
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file based on [.env.example](.env.example) and set:
   - `OPENAI_API_KEY` – **keep this secret**; do not commit it.
   - (Optional) `PORT` – defaults to `3001`.

4. Run the development servers:

   ```bash
   npm run dev
   ```

   This starts Vite on http://localhost:5173 with a proxy to the Express server on http://localhost:3001.

5. Open the app in your browser. Swipe through the sample event deck to get a feel for the layout, then enter any description of the events you want (e.g. “free tech meetups in DC this week”) and press **Search**. The UI calls `/api/agent-response?q=<your+query>`, which in turn issues an OpenAI Responses API call (model `gpt-4o-mini` with the `web_search` tool) and renders the structured JSON returned by the model.

## Production build

```bash
npm run build
```

Serve the content from the `dist` directory and ensure the Express proxy is running (see `npm run server`).

## Security note

Never expose your real `OPENAI_API_KEY` in client-side code or version control. Keep it in environment variables on the server (as configured here) and share only placeholders when collaborating.
