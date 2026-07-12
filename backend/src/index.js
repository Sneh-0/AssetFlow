// Local development entrypoint — starts a long-running HTTP server.
// In production on Vercel the app is served as a serverless function
// (see /api/[...path].js), which imports the same app from ./app.js.
import app from './app.js';

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 AssetFlow API on http://localhost:${PORT}`));
