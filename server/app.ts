import express, { Express, Request, Response, Router } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { getDb } from './db.js';

export interface ShareDocument {
  _id: string;
  title: string;
  content: string;
  theme: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactDocument {
  email: string;
  message: string;
  createdAt: Date;
}

const app: Express = express();

// Trust proxy for rate limiting behind reverse proxies / Vercel
app.set('trust proxy', 1);

// JSON body parser with 2MB limit
app.use(express.json({ limit: '2mb' }));

// CORS headers
app.use(cors());

// Rate limiters
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many contact requests from this IP. Please try again after 15 minutes.' },
});

const shareCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many shares created. Please try again later.' },
});

const shareUpdateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many updates sent. Please slow down.' },
});

const shareReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  max: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// Modular router supporting both /api/shares and /shares (if Vercel rewrites strip /api prefix)
const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// POST /shares - Create a new share document
apiRouter.post('/shares', shareCreateLimiter, async (req: Request, res: Response) => {
  try {
    const { content, theme, title } = req.body || {};
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Content is required and must be a non-empty string.' });
    }

    const db = await getDb();
    const doc: ShareDocument = {
      _id: randomUUID(),
      title: typeof title === 'string' ? title.trim().slice(0, 200) : '',
      content,
      theme: typeof theme === 'string' && theme.trim() ? theme.trim() : 'professional',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection<ShareDocument>('shares').insertOne(doc);
    return res.status(201).json({ id: doc._id, version: doc.version });
  } catch (error) {
    console.error('Error creating share:', error);
    return res.status(500).json({ error: 'Failed to create share document' });
  }
});

// GET /shares/:id - Retrieve share document with conditional 304 support
apiRouter.get('/shares/:id', shareReadLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid share ID.' });
    }

    const db = await getDb();
    const doc = await db.collection<ShareDocument>('shares').findOne({ _id: id });
    if (!doc) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const currentEtag = `W/"${doc.version}"`;
    const lastModified = new Date(doc.updatedAt).toUTCString();
    res.setHeader('ETag', currentEtag);
    res.setHeader('Last-Modified', lastModified);

    // Check version query param, If-None-Match header, or If-Modified-Since for conditional 304 response
    const versionQuery = req.query.version;
    const requestedVersion = versionQuery !== undefined ? parseInt(String(versionQuery), 10) : NaN;
    const ifNoneMatch = req.header('if-none-match') || req.headers['if-none-match'];
    const ifModifiedSince = req.header('if-modified-since') || req.headers['if-modified-since'];

    const isVersionMatched = !isNaN(requestedVersion) && requestedVersion === doc.version;
    const isEtagMatched =
      Boolean(ifNoneMatch) &&
      (ifNoneMatch === currentEtag ||
        ifNoneMatch === `"${doc.version}"` ||
        ifNoneMatch === String(doc.version));
    const isNotModifiedSince =
      Boolean(ifModifiedSince) && new Date(String(ifModifiedSince)) >= new Date(doc.updatedAt);

    if (isVersionMatched || isEtagMatched || isNotModifiedSince) {
      return res.status(304).end();
    }

    return res.status(200).json({
      id: doc._id,
      content: doc.content,
      theme: doc.theme,
      title: doc.title || '',
      version: doc.version,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    console.error('Error retrieving share:', error);
    return res.status(500).json({ error: 'Failed to retrieve share document' });
  }
});

// PUT /shares/:id - Update content, theme, title, increment version
apiRouter.put('/shares/:id', shareUpdateLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, theme, title } = req.body || {};

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid share ID.' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string.' });
    }

    const db = await getDb();
    const updateDoc = {
      content,
      theme: typeof theme === 'string' && theme.trim() ? theme.trim() : 'professional',
      title: typeof title === 'string' ? title.trim().slice(0, 200) : '',
      updatedAt: new Date(),
    };

    const rawResult = await db.collection<ShareDocument>('shares').findOneAndUpdate(
      { _id: id },
      {
        $set: updateDoc,
        $inc: { version: 1 },
      },
      { returnDocument: 'after' }
    );

    // Support both MongoDB driver v6+ return (doc directly) and legacy/wrapper ({ value: doc })
    const resultDoc =
      rawResult && typeof rawResult === 'object' && 'value' in rawResult
        ? (rawResult as any).value
        : rawResult;

    if (!resultDoc) {
      return res.status(404).json({ error: 'Share not found' });
    }

    return res.status(200).json({
      success: true,
      id: resultDoc._id,
      version: resultDoc.version,
      updatedAt: resultDoc.updatedAt,
    });
  } catch (error) {
    console.error('Error updating share:', error);
    return res.status(500).json({ error: 'Failed to update share document' });
  }
});

// POST /contact - Submit contact form message
apiRouter.post('/contact', contactLimiter, async (req: Request, res: Response) => {
  try {
    const { email, message } = req.body || {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    if (trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
      return res.status(400).json({ error: 'Message must be between 10 and 5000 characters.' });
    }

    const db = await getDb();
    const doc: ContactDocument = {
      email: email.trim().toLowerCase(),
      message: trimmedMessage,
      createdAt: new Date(),
    };

    await db.collection<ContactDocument>('contact_messages').insertOne(doc);
    return res.status(201).json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Error submitting contact message:', error);
    return res.status(500).json({ error: 'Failed to submit contact message' });
  }
});

// Mount router on both /api (standard) and / (for stripped serverless routes)
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
