// Vercel serverless entrypoint. This catch-all file receives every request to
// /api/* and hands it to the Express app, which already mounts its routes under
// the /api prefix. No app.listen() runs here — Vercel invokes the exported
// handler per request.
import app from '../backend/src/app.js';

export default app;
