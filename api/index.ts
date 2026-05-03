// Vercel serverless entry point — exports the Express app as the default handler.
// Vercel's @vercel/node runtime wraps this automatically; no app.listen() needed.
import app from "../src/app";

export default app;
