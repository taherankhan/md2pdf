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

// server/app.ts
var app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(cors());
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
apiRouter.post("/shares", shareCreateLimiter, async (req, res) => {
  try {
    const { content, theme, title } = req.body || {};
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Content is required and must be a non-empty string." });
    }
    const db = await getDb();
    const doc = {
      _id: randomUUID(),
      title: typeof title === "string" ? title.trim().slice(0, 200) : "",
      content,
      theme: typeof theme === "string" && theme.trim() ? theme.trim() : "professional",
      version: 1,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    await db.collection("shares").insertOne(doc);
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
  app_default as default
};
