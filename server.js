/*
 * About Me Website - Server-side JavaScript
 * Cesar Espitia
 *
 * Express server that:
 *  - Serves all 6 static pages
 *  - Handles contact form submissions (POST /api/contact)
 *  - Stores submissions in Replit App Storage at data/contactReceived.json
 *  - Protects admin endpoints with a Replit Secrets password
 *  - Provides admin endpoints for the dashboard (login, messages, mark replied)
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------------------------------------------------
 * Constants
 * --------------------------------------------------------- */

const DATA_PATH = "data/contactReceived.json"; // Replit App Storage object path
const VALID_REASONS = [
  "Comment",
  "Question",
  "Partnership",
  "Opportunity",
  "Other",
];

/* ---------------------------------------------------------
 * Storage layer: Replit App Storage (Object Storage)
 * Falls back to the local ./data folder only when running
 * outside of Replit (for local testing).
 * --------------------------------------------------------- */

let objectStorage = null;
try {
  const { Client } = require("@replit/object-storage");
  objectStorage = new Client();
  console.log("Storing contact data in Replit App Storage at " + DATA_PATH);
} catch (err) {
  console.warn(
    "@replit/object-storage not available. Falling back to the local ./data folder for development."
  );
}

async function readMessages() {
  if (objectStorage) {
    // Check if the file exists in App Storage; initialize it to [] if missing
    const existsResult = await objectStorage.exists(DATA_PATH);
    if (!existsResult || existsResult.exists === false) {
      await objectStorage.uploadFromText(DATA_PATH, "[]");
      return [];
    }
    const result = await objectStorage.downloadAsText(DATA_PATH);
    if (!result.ok) {
      const err = new Error(result.error || "Failed to read App Storage");
      err.statusCode = 500;
      throw err;
    }
    try {
      const parsed = JSON.parse(result.text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (parseErr) {
      // Corrupt file - re-initialize to a valid empty array
      await objectStorage.uploadFromText(DATA_PATH, "[]");
      return [];
    }
  }

  // Local filesystem fallback (development only)
  const filePath = path.join(__dirname, DATA_PATH);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "[]");
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (parseErr) {
    fs.writeFileSync(filePath, "[]");
    return [];
  }
}

async function writeMessages(messages) {
  if (objectStorage) {
    const result = await objectStorage.uploadFromText(
      DATA_PATH,
      JSON.stringify(messages, null, 2)
    );
    if (!result || result.ok === false) {
      const err = new Error(
        (result && result.error) || "Failed to write App Storage"
      );
      err.statusCode = 500;
      throw err;
    }
    return;
  }

  // Local filesystem fallback (development only)
  const filePath = path.join(__dirname, DATA_PATH);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
}

/* ---------------------------------------------------------
 * Admin authentication
 * The password lives in Replit Secrets (ADMIN_PASSWORD).
 * It is NEVER sent to the browser or stored in client code.
 * --------------------------------------------------------- */

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    "WARNING: ADMIN_PASSWORD secret is not set. Using the development default. " +
      "Set a Replit Secret named ADMIN_PASSWORD before publishing!"
  );
}

// Deterministic session token derived from the password.
// The browser only ever holds this token, never the password itself.
const SESSION_TOKEN = crypto
  .createHmac("sha256", ADMIN_PASSWORD)
  .update("about-me-admin-session-v1")
  .digest("hex");

function isValidToken(token) {
  if (typeof token !== "string" || token.length === 0) return false;
  const a = Buffer.from(SESSION_TOKEN);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!isValidToken(token)) {
    return res
      .status(401)
      .json({ error: "Unauthorized. Please sign in as admin." });
  }
  next();
}

/* ---------------------------------------------------------
 * Middleware
 * --------------------------------------------------------- */

// Never expose the data folder or server files to the public
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (
    p.startsWith("/data") ||
    p === "/server.js" ||
    p === "/package.json" ||
    p === "/package-lock.json" ||
    p === "/replit.nix"
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

app.use(express.json({ limit: "100kb" }));

// Serve the website's static files
app.use(express.static(__dirname, { index: "index.html", extensions: ["html"] }));

/* ---------------------------------------------------------
 * API: Contact form
 * --------------------------------------------------------- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/contact", async (req, res) => {
  try {
    const { firstName, lastName, email, reason, message } = req.body || {};

    // Validate required fields
    const errors = [];
    if (typeof firstName !== "string" || !firstName.trim())
      errors.push("First name is required.");
    if (typeof lastName !== "string" || !lastName.trim())
      errors.push("Last name is required.");
    if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim()))
      errors.push("A valid email address is required.");
    if (!VALID_REASONS.includes(reason))
      errors.push("Reason for contact is required.");
    if (typeof message !== "string" || !message.trim())
      errors.push("Message is required.");

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(" ") });
    }

    // Build the new submission record
    const record = {
      id: crypto.randomUUID(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      reason: reason,
      message: message.trim(),
      submittedAt: new Date().toISOString(),
      replied: false,
      repliedAt: null,
    };

    // Read current data, append, write back
    const messages = await readMessages();
    messages.push(record);
    await writeMessages(messages);

    return res.status(201).json({
      message: "Your message was sent successfully. Thank you!",
      record: record,
    });
  } catch (err) {
    console.error("Contact submission failed:", err);
    return res
      .status(500)
      .json({ error: "A storage error occurred. Please try again later." });
  }
});

/* ---------------------------------------------------------
 * API: Admin
 * --------------------------------------------------------- */

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({ error: "Incorrect admin password." });
  }
  return res.status(200).json({ token: SESSION_TOKEN });
});

app.get("/api/admin/messages", requireAdmin, async (req, res) => {
  try {
    const messages = await readMessages();
    // Newest messages first
    const sorted = messages.slice().sort((a, b) =>
      String(b.submittedAt).localeCompare(String(a.submittedAt))
    );
    return res.status(200).json({ messages: sorted });
  } catch (err) {
    console.error("Failed to load admin messages:", err);
    return res.status(500).json({ error: "Failed to load messages." });
  }
});

app.patch("/api/admin/messages/:id/replied", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await readMessages();
    const record = messages.find((m) => m.id === id);

    if (!record) {
      return res.status(404).json({ error: "Message not found." });
    }

    record.replied = true;
    record.repliedAt = new Date().toISOString();

    await writeMessages(messages);

    return res.status(200).json({
      message: "Message marked as replied.",
      record: record,
    });
  } catch (err) {
    console.error("Failed to mark message as replied:", err);
    return res.status(500).json({ error: "Failed to update message." });
  }
});

/* ---------------------------------------------------------
 * Fallback + start
 * --------------------------------------------------------- */

app.use((req, res) => {
  res.status(404).send(
    "<h1 style='font-family:sans-serif'>404 - Page not found</h1>" +
      "<p style='font-family:sans-serif'><a href='/'>Back to home</a></p>"
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("About Me website running on port " + PORT);
});
