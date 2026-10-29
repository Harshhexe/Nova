import { suggestionsHandler } from '../server/suggestions.mjs';

// Vercel discovers this file as the website's /api/suggest serverless route.
export default function handler(req, res) {
  return suggestionsHandler(req, res);
}
