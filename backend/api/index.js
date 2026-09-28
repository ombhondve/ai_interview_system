import app from "../src/app.js";
import connectDatabase from "../src/config/database.js";

let connecting;

export default async function handler(req, res) {
  try {
    connecting ??= connectDatabase();
    await connecting;
  } catch (error) {
    connecting = null;
    console.error("Database connection failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Database connection failed" });
  }

  return app(req, res);
}