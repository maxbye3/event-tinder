import { createAgentResponse } from '../../server/agentResponse.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Missing OPENAI_API_KEY environment variable.' }),
    };
  }

  try {
    const query = event.queryStringParameters?.q ?? '';
    const payload = await createAgentResponse({ apiKey, query });

    console.log('[netlify] response', JSON.stringify(payload, null, 2));

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Netlify function failed:', message);

    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};
