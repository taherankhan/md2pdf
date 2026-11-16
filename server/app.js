// server/app.ts
import express, { Router } from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "crypto";

// server/db.ts
import { MongoClient } from "mongodb";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
if (!process.env.MONGODB_URI) {
  const candidatePaths = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "md2pdf", ".env"),
    fileURLToPath(new URL("../.env", import.meta.url))
  ];
  for (const envPath of candidatePaths) {
    if (existsSync(envPath)) {
      if (typeof process.loadEnvFile === "function") {
        try {
          process.loadEnvFile(envPath);
          if (process.env.MONGODB_URI) break;
        } catch {
        }
      } else {
        try {
          const content = readFileSync(envPath, "utf-8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx > 0) {
              const k = trimmed.slice(0, eqIdx).trim();
              const v = trimmed.slice(eqIdx + 1).trim();
              if (!process.env[k]) process.env[k] = v;
            }
          }
          if (process.env.MONGODB_URI) break;
        } catch {
        }
      }
    }
  }
}
function getMongoCache() {
  if (!global._mongoCache) {
    global._mongoCache = {
      client: null,
      db: null,
      promise: null
    };
  }
  return global._mongoCache;
}
async function connectToDatabase() {
  const cache = getMongoCache();
  if (cache.client && cache.db) {
    return { client: cache.client, db: cache.db };
  }
  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB_NAME || "md2pdf";
    if (!uri) {
      throw new Error("Please define the MONGODB_URI environment variable inside .env or server environment.");
    }
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5e3
    });
    cache.promise = client.connect().then((connectedClient) => {
      const db = connectedClient.db(dbName);
      cache.client = connectedClient;
      cache.db = db;
      return { client: connectedClient, db };
    }).catch((error) => {
      cache.promise = null;
      throw error;
    });
  }
  try {
    return await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}
async function getDb() {
  const { db } = await connectToDatabase();
  return db;
}

// server/pdfService.ts
import puppeteer from "puppeteer-core";
import { existsSync as existsSync2 } from "fs";
function getChromeExecutablePath() {
  const customPath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (customPath && existsSync2(customPath)) {
    return customPath;
  }
  const candidatePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : "",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].filter(Boolean);
  for (const candidate of candidatePaths) {
    if (existsSync2(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    "Chrome/Chromium executable not found. Please install Google Chrome or set CHROME_PATH environment variable."
  );
}
var cachedBrowser = null;
async function getOrLaunchBrowser() {
  if (cachedBrowser && cachedBrowser.connected) {
    return cachedBrowser;
  }
  const executablePath = getChromeExecutablePath();
  cachedBrowser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=medium",
      "--disable-extensions"
    ]
  });
  cachedBrowser.on("disconnected", () => {
    cachedBrowser = null;
  });
  return cachedBrowser;
}
async function generatePdfBuffer(options) {
  const browser = await getOrLaunchBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(options.html, {
      waitUntil: "load",
      timeout: 3e4
    });
    await page.waitForFunction(
      () => {
        const mermaidNodes = document.querySelectorAll(".mermaid");
        if (mermaidNodes.length === 0) return true;
        return Array.from(mermaidNodes).every(
          (el) => el.querySelector("svg") !== null || el.textContent?.includes("Syntax Error")
        );
      },
      { timeout: 15e3 }
    ).catch(() => {
    });
    const docTitle = options.title && options.title.trim() || "Document";
    await page.evaluate((title) => {
      document.title = title;
    }, docTitle);
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });
    await new Promise((r) => setTimeout(r, 350));
    const margins = options.margins || { top: 15, right: 15, bottom: 15, left: 15 };
    const validFormats = ["A4", "A3", "A5", "Letter", "Legal"];
    const requestedFormat = options.pageSize && validFormats.includes(options.pageSize) ? options.pageSize : "A4";
    const pdfUint8Array = await page.pdf({
      format: requestedFormat,
      printBackground: true,
      tagged: true,
      margin: {
        top: `${margins.top ?? 15}mm`,
        right: `${margins.right ?? 15}mm`,
        bottom: `${margins.bottom ?? 15}mm`,
        left: `${margins.left ?? 15}mm`
      },
      preferCSSPageSize: true
    });
    return Buffer.from(pdfUint8Array);
  } finally {
    await page.close().catch(() => {
    });
  }
}

// server/auth.js
import { createHmac, timingSafeEqual } from "crypto";
var DEFAULT_JWT_SECRET = "md2pdfx-auth-session-secret-change-in-prod-2026";
function getJwtSecret() {
  return process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
}
function base64UrlEncode(str) {
  return Buffer.from(str, "utf-8").toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}
function createSessionToken(payload) {
  const secret = getJwtSecret();
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1e3);
  const exp = now + 30 * 24 * 60 * 60;
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: now,
      exp
    })
  );
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${body}.${signature}`;
}
function verifySessionToken(token) {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, signatureB64] = parts;
    const secret = getJwtSecret();
    const expectedSig = createHmac("sha256", secret).update(`${headerB64}.${bodyB64}`).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const expectedBuffer = Buffer.from(expectedSig);
    const actualBuffer = Buffer.from(signatureB64);
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(bodyB64));
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    if (!payload.userId || !payload.email) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name || "",
      picture: payload.picture || ""
    };
  } catch {
    return null;
  }
}
async function verifyGoogleIdToken(idToken) {
  try {
    if (!idToken || typeof idToken !== "string") return null;
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!res.ok) {
      console.warn("Google token verification failed with status:", res.status);
      return null;
    }
    const data = await res.json();
    if (!data.sub || !data.email) {
      return null;
    }
    const configuredAud = process.env.GOOGLE_CLIENT_ID;
    if (configuredAud && data.aud && data.aud !== configuredAud) {
      console.warn(`Token audience mismatch: got ${data.aud}, expected ${configuredAud}`);
      return null;
    }
    return {
      googleId: data.sub,
      email: data.email.toLowerCase(),
      name: data.name || data.email.split("@")[0],
      picture: data.picture || ""
    };
  } catch (err) {
    console.error("Error verifying Google ID token:", err);
    return null;
  }
}
function extractToken(req) {
  const authHeader = req.header("authorization") || req.headers["authorization"];
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.header("cookie") || req.headers["cookie"];
  if (cookieHeader && typeof cookieHeader === "string") {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith("auth_token=")) {
        return decodeURIComponent(cookie.slice("auth_token=".length));
      }
    }
  }
  return null;
}
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const user = verifySessionToken(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  req.user = user;
  next();
}
function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    const user = verifySessionToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}

// server/app.ts
var app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use(cors({ origin: true, credentials: true }));
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  limit: 30,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." }
});
var docLimiter = rateLimit({
  windowMs: 60 * 1e3,
  limit: 200,
  max: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false
});
var contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  limit: 10,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many contact requests from this IP. Please try again after 15 minutes." }
});
var shareCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  limit: 60,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many shares created. Please try again later." }
});
var shareUpdateLimiter = rateLimit({
  windowMs: 60 * 1e3,
  limit: 120,
  max: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many updates sent. Please slow down." }
});
var shareReadLimiter = rateLimit({
  windowMs: 60 * 1e3,
  limit: 240,
  max: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false
});
var apiRouter = Router();
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
apiRouter.post("/pdf/generate", async (req, res) => {
  try {
    const { html, title, margins, smartPageBreaks, pageSize } = req.body || {};
    if (!html || typeof html !== "string") {
      return res.status(400).json({ error: "HTML content string is required for PDF generation." });
    }
    const rawTitle = title && typeof title === "string" && title.trim() || "Document";
    const pdfBuffer = await generatePdfBuffer({
      html,
      title: rawTitle,
      margins,
      smartPageBreaks,
      pageSize: typeof pageSize === "string" ? pageSize : void 0
    });
    const safeFilename = rawTitle.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 80) || "document";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("[puppeteer pdf generation error]:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Server PDF generation failed."
    });
  }
});
apiRouter.post("/auth/google", authLimiter, async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential || typeof credential !== "string") {
      return res.status(400).json({ error: "Google credential token is required" });
    }
    const profile = await verifyGoogleIdToken(credential);
    if (!profile) {
      return res.status(401).json({ error: "Invalid or expired Google credential" });
    }
    const db = await getDb();
    const usersCol = db.collection("users");
    const now = /* @__PURE__ */ new Date();
    const rawResult = await usersCol.findOneAndUpdate(
      { googleId: profile.googleId },
      {
        $set: {
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          updatedAt: now,
          lastLoginAt: now
        },
        $setOnInsert: {
          _id: randomUUID(),
          createdAt: now
        }
      },
      { upsert: true, returnDocument: "after" }
    );
    const userDoc = rawResult && typeof rawResult === "object" && "value" in rawResult ? rawResult.value : rawResult;
    if (!userDoc) {
      return res.status(500).json({ error: "Failed to record user account" });
    }
    const sessionPayload = {
      userId: userDoc._id,
      email: userDoc.email,
      name: userDoc.name,
      picture: userDoc.picture
    };
    const token = createSessionToken(sessionPayload);
    res.setHeader(
      "Set-Cookie",
      `auth_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
    );
    return res.status(200).json({
      success: true,
      user: sessionPayload,
      token
    });
  } catch (error) {
    console.error("Error during Google authentication:", error);
    return res.status(500).json({ error: "Internal server error during authentication" });
  }
});
apiRouter.get("/auth/me", optionalAuth, (req, res) => {
  if (req.user) {
    return res.status(200).json({ user: req.user });
  }
  return res.status(401).json({ user: null });
});
apiRouter.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res.status(200).json({ success: true, message: "Logged out successfully" });
});
apiRouter.get("/documents", requireAuth, docLimiter, async (req, res) => {
  try {
    const db = await getDb();
    const docs = await db.collection("documents").find({ userId: req.user.userId }, { projection: { content: 0 } }).sort({ updatedAt: -1 }).toArray();
    return res.status(200).json({ documents: docs });
  } catch (error) {
    console.error("Error fetching user documents:", error);
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
});
apiRouter.post("/documents", requireAuth, docLimiter, async (req, res) => {
  try {
    const { title, content, theme } = req.body || {};
    const db = await getDb();
    const doc = {
      _id: randomUUID(),
      userId: req.user.userId,
      title: typeof title === "string" && title.trim() ? title.trim().slice(0, 200) : "Untitled document",
      content: typeof content === "string" ? content : "",
      theme: typeof theme === "string" && theme.trim() ? theme.trim() : "professional",
      shareId: null,
      isPublic: false,
      version: 1,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    await db.collection("documents").insertOne(doc);
    return res.status(201).json(doc);
  } catch (error) {
    console.error("Error creating document:", error);
    return res.status(500).json({ error: "Failed to create document" });
  }
});
apiRouter.get("/documents/:id", requireAuth, docLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const doc = await db.collection("documents").findOne({ _id: id, userId: req.user.userId });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    return res.status(200).json(doc);
  } catch (error) {
    console.error("Error fetching document:", error);
    return res.status(500).json({ error: "Failed to fetch document" });
  }
});
apiRouter.put("/documents/:id", requireAuth, docLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, theme } = req.body || {};
    const db = await getDb();
    const updateFields = { updatedAt: /* @__PURE__ */ new Date() };
    if (typeof title === "string") updateFields.title = title.trim().slice(0, 200);
    if (typeof content === "string") updateFields.content = content;
    if (typeof theme === "string" && theme.trim()) updateFields.theme = theme.trim();
    const rawResult = await db.collection("documents").findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      {
        $set: updateFields,
        $inc: { version: 1 }
      },
      { returnDocument: "after" }
    );
    const updatedDoc = rawResult && typeof rawResult === "object" && "value" in rawResult ? rawResult.value : rawResult;
    if (!updatedDoc) {
      return res.status(404).json({ error: "Document not found" });
    }
    if (updatedDoc.shareId) {
      await db.collection("shares").updateOne(
        { _id: updatedDoc.shareId },
        {
          $set: {
            title: updatedDoc.title,
            content: updatedDoc.content,
            theme: updatedDoc.theme,
            updatedAt: updatedDoc.updatedAt
          },
          $inc: { version: 1 }
        }
      );
    }
    return res.status(200).json({
      success: true,
      document: updatedDoc
    });
  } catch (error) {
    console.error("Error updating document:", error);
    return res.status(500).json({ error: "Failed to update document" });
  }
});
apiRouter.delete("/documents/:id", requireAuth, docLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const doc = await db.collection("documents").findOne({ _id: id, userId: req.user.userId });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    await db.collection("documents").deleteOne({ _id: id });
    if (doc.shareId) {
      await db.collection("shares").deleteOne({ _id: doc.shareId });
    }
    return res.status(200).json({ success: true, message: "Document deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    return res.status(500).json({ error: "Failed to delete document" });
  }
});
apiRouter.post("/documents/:id/share", requireAuth, docLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const doc = await db.collection("documents").findOne({ _id: id, userId: req.user.userId });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    if (doc.shareId) {
      const existingShare = await db.collection("shares").findOne({ _id: doc.shareId });
      if (existingShare) {
        return res.status(200).json({
          shareId: existingShare._id,
          version: existingShare.version
        });
      }
    }
    const newShareId = randomUUID();
    const shareDoc = {
      _id: newShareId,
      documentId: doc._id,
      ownerUserId: req.user.userId,
      title: doc.title,
      content: doc.content,
      theme: doc.theme,
      version: 1,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    await db.collection("shares").insertOne(shareDoc);
    await db.collection("documents").updateOne(
      { _id: doc._id },
      { $set: { shareId: newShareId, isPublic: true, updatedAt: /* @__PURE__ */ new Date() } }
    );
    return res.status(201).json({
      shareId: newShareId,
      version: shareDoc.version
    });
  } catch (error) {
    console.error("Error generating share link for document:", error);
    return res.status(500).json({ error: "Failed to create share link" });
  }
});
apiRouter.post("/shares", shareCreateLimiter, optionalAuth, async (req, res) => {
  try {
    const { content, theme, title, documentId } = req.body || {};
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Content is required and must be a non-empty string." });
    }
    const db = await getDb();
    const doc = {
      _id: randomUUID(),
      documentId: typeof documentId === "string" ? documentId : null,
      ownerUserId: req.user ? req.user.userId : null,
      title: typeof title === "string" ? title.trim().slice(0, 200) : "",
      content,
      theme: typeof theme === "string" && theme.trim() ? theme.trim() : "professional",
      version: 1,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    await db.collection("shares").insertOne(doc);
    if (doc.documentId && req.user) {
      await db.collection("documents").updateOne(
        { _id: doc.documentId, userId: req.user.userId },
        { $set: { shareId: doc._id, isPublic: true, updatedAt: /* @__PURE__ */ new Date() } }
      );
    }
    return res.status(201).json({ id: doc._id, version: doc.version });
  } catch (error) {
    console.error("Error creating share:", error);
    return res.status(500).json({ error: "Failed to create share document" });
  }
});
apiRouter.get("/shares/:id", shareReadLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid share ID." });
    }
    const db = await getDb();
    const doc = await db.collection("shares").findOne({ _id: id });
    if (!doc) {
      return res.status(404).json({ error: "Share not found" });
    }
    const currentEtag = `W/"${doc.version}"`;
    const lastModified = new Date(doc.updatedAt).toUTCString();
    res.setHeader("ETag", currentEtag);
    res.setHeader("Last-Modified", lastModified);
    const versionQuery = req.query.version;
    const requestedVersion = versionQuery !== void 0 ? parseInt(String(versionQuery), 10) : NaN;
    const ifNoneMatch = req.header("if-none-match") || req.headers["if-none-match"];
    const ifModifiedSince = req.header("if-modified-since") || req.headers["if-modified-since"];
    const isVersionMatched = !isNaN(requestedVersion) && requestedVersion === doc.version;
    const isEtagMatched = Boolean(ifNoneMatch) && (ifNoneMatch === currentEtag || ifNoneMatch === `"${doc.version}"` || ifNoneMatch === String(doc.version));
    const isNotModifiedSince = Boolean(ifModifiedSince) && new Date(String(ifModifiedSince)) >= new Date(doc.updatedAt);
    if (isVersionMatched || isEtagMatched || isNotModifiedSince) {
      return res.status(304).end();
    }
    return res.status(200).json({
      id: doc._id,
      documentId: doc.documentId || null,
      ownerUserId: doc.ownerUserId || null,
      content: doc.content,
      theme: doc.theme,
      title: doc.title || "",
      version: doc.version,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  } catch (error) {
    console.error("Error retrieving share:", error);
    return res.status(500).json({ error: "Failed to retrieve share document" });
  }
});
apiRouter.put("/shares/:id", shareUpdateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, theme, title } = req.body || {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid share ID." });
    }
    if (typeof content !== "string") {
      return res.status(400).json({ error: "Content must be a string." });
    }
    const db = await getDb();
    const updateDoc = {
      content,
      theme: typeof theme === "string" && theme.trim() ? theme.trim() : "professional",
      title: typeof title === "string" ? title.trim().slice(0, 200) : "",
      updatedAt: /* @__PURE__ */ new Date()
    };
    const rawResult = await db.collection("shares").findOneAndUpdate(
      { _id: id },
      {
        $set: updateDoc,
        $inc: { version: 1 }
      },
      { returnDocument: "after" }
    );
    const resultDoc = rawResult && typeof rawResult === "object" && "value" in rawResult ? rawResult.value : rawResult;
    if (!resultDoc) {
      return res.status(404).json({ error: "Share not found" });
    }
    if (resultDoc.documentId) {
      await db.collection("documents").updateOne(
        { _id: resultDoc.documentId },
        {
          $set: {
            content: resultDoc.content,
            theme: resultDoc.theme,
            title: resultDoc.title,
            updatedAt: resultDoc.updatedAt
          },
          $inc: { version: 1 }
        }
      );
    }
    return res.status(200).json({
      success: true,
      id: resultDoc._id,
      version: resultDoc.version,
      updatedAt: resultDoc.updatedAt
    });
  } catch (error) {
    console.error("Error updating share:", error);
    return res.status(500).json({ error: "Failed to update share document" });
  }
});
apiRouter.post("/contact", contactLimiter, async (req, res) => {
  try {
    const { email, message } = req.body || {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: "A valid email address is required." });
    }
    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    if (trimmedMessage.length < 10 || trimmedMessage.length > 5e3) {
      return res.status(400).json({ error: "Message must be between 10 and 5000 characters." });
    }
    const db = await getDb();
    const doc = {
      email: email.trim().toLowerCase(),
      message: trimmedMessage,
      createdAt: /* @__PURE__ */ new Date()
    };
    await db.collection("contact_messages").insertOne(doc);
    return res.status(201).json({ success: true, message: "Message sent successfully." });
  } catch (error) {
    console.error("Error submitting contact message:", error);
    return res.status(500).json({ error: "Failed to submit contact message" });
  }
});
app.use("/api", apiRouter);
app.use("/", apiRouter);
var app_default = app;
export {
  app_default as default,
  generatePdfBuffer
};
