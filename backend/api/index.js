import "../src/config/suppressWarnings.js";
import app from "../src/app.js";

// The Express app is already configured with CORS and routing
// We just need to export it as a serverless function
export default async function handler(req, res) {
  // The app handles all routing, middleware, and error handling
  return app(req, res);
}