import express, { Express, Request, Response, Router } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { getDb } from './db.js';
import { generatePdfBuffer } from './pdfService.js';
import {
  verifyGoogleIdToken,
  createSessionToken,
  requireAuth,
  optionalAuth,
  UserSessionPayload,
} from './auth.js';

export interface UserDocument {
  _id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

export interface MarkdownDocument {
  _id: string;
  userId: string;
  title: string;
  content: string;
  theme: string;
  shareId?: string | null;
  isPublic: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShareDocument {
  _id: string;
  documentId?: string | null;
  ownerUserId?: string | null;
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

// JSON body parser with 25MB limit for rich documents and diagrams
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// CORS headers
app.use(cors({ origin: true, credentials: true }));

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

const docLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  max: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

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

// Modular router supporting both /api and root mounts
const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ==============================================================================
// PDF GENERATION ROUTES (PUPPETEER HEADLESS CHROMIUM)
// ==============================================================================

// POST /pdf/generate - High-fidelity vector PDF generation
apiRouter.post('/pdf/generate', async (req: Request, res: Response) => {
  try {
    const { html, title, margins, smartPageBreaks } = req.body || {};
    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'HTML content string is required for PDF generation.' });
    }

    const rawTitle = (title && typeof title === 'string' && title.trim()) || 'Document';
    const pdfBuffer = await generatePdfBuffer({
      html,
      title: rawTitle,
      margins,
      smartPageBreaks,
    });

    const safeFilename =
      rawTitle
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 80) || 'document';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('[puppeteer pdf generation error]:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Server PDF generation failed.',
    });
  }
});

// ==============================================================================
// AUTHENTICATION ROUTES
// ==============================================================================

// POST /auth/google - Authenticate with Google ID Token credential
apiRouter.post('/auth/google', authLimiter, async (req: Request, res: Response) => {
  try {
    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Google credential token is required' });
    }

    const profile = await verifyGoogleIdToken(credential);
    if (!profile) {
      return res.status(401).json({ error: 'Invalid or expired Google credential' });
    }

    const db = await getDb();
    const usersCol = db.collection<UserDocument>('users');

    const now = new Date();
    const rawResult = await usersCol.findOneAndUpdate(
      { googleId: profile.googleId },
      {
        $set: {
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          updatedAt: now,
          lastLoginAt: now,
        },
        $setOnInsert: {
          _id: randomUUID(),
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const userDoc: UserDocument =
      rawResult && typeof rawResult === 'object' && 'value' in rawResult
        ? (rawResult as any).value
        : rawResult;

    if (!userDoc) {
      return res.status(500).json({ error: 'Failed to record user account' });
    }

    const sessionPayload: UserSessionPayload = {
      userId: userDoc._id,
      email: userDoc.email,
      name: userDoc.name,
      picture: userDoc.picture,
    };

    const token = createSessionToken(sessionPayload);

    // Set secure HTTP-only cookie (30 days)
    res.setHeader(
      'Set-Cookie',
      `auth_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
    );

    return res.status(200).json({
      success: true,
      user: sessionPayload,
      token,
    });
  } catch (error) {
    console.error('Error during Google authentication:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

// GET /auth/me - Retrieve current authenticated user
apiRouter.get('/auth/me', optionalAuth, (req: Request, res: Response) => {
  if (req.user) {
    return res.status(200).json({ user: req.user });
  }
  return res.status(401).json({ user: null });
});

// POST /auth/logout - Clear user session
apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', 'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// ==============================================================================
// USER DOCUMENTS ROUTES (Protected)
// ==============================================================================

// GET /documents - List all documents belonging to current user
apiRouter.get('/documents', requireAuth, docLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const docs = await db
      .collection<MarkdownDocument>('documents')
      .find({ userId: req.user!.userId }, { projection: { content: 0 } })
      .sort({ updatedAt: -1 })
      .toArray();

    return res.status(200).json({ documents: docs });
  } catch (error) {
    console.error('Error fetching user documents:', error);
    return res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /documents - Create a new document in library
apiRouter.post('/documents', requireAuth, docLimiter, async (req: Request, res: Response) => {
  try {
    const { title, content, theme } = req.body || {};
    const db = await getDb();

    const doc: MarkdownDocument = {
      _id: randomUUID(),
      userId: req.user!.userId,
      title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : 'Untitled document',
      content: typeof content === 'string' ? content : '',
      theme: typeof theme === 'string' && theme.trim() ? theme.trim() : 'professional',
      shareId: null,
      isPublic: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection<MarkdownDocument>('documents').insertOne(doc);
    return res.status(201).json(doc);
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({ error: 'Failed to create document' });
  }
});

// GET /documents/:id - Get full document by ID
apiRouter.get('/documents/:id', requireAuth, docLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const doc = await db
      .collection<MarkdownDocument>('documents')
      .findOne({ _id: id, userId: req.user!.userId });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.status(200).json(doc);
  } catch (error) {
    console.error('Error fetching document:', error);
    return res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// PUT /documents/:id - Update document (and sync to public share if published)
apiRouter.put('/documents/:id', requireAuth, docLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, theme } = req.body || {};

    const db = await getDb();
    const updateFields: any = { updatedAt: new Date() };

    if (typeof title === 'string') updateFields.title = title.trim().slice(0, 200);
    if (typeof content === 'string') updateFields.content = content;
    if (typeof theme === 'string' && theme.trim()) updateFields.theme = theme.trim();

    const rawResult = await db.collection<MarkdownDocument>('documents').findOneAndUpdate(
      { _id: id, userId: req.user!.userId },
      {
        $set: updateFields,
        $inc: { version: 1 },
      },
      { returnDocument: 'after' }
    );

    const updatedDoc: MarkdownDocument =
      rawResult && typeof rawResult === 'object' && 'value' in rawResult
        ? (rawResult as any).value
        : rawResult;

    if (!updatedDoc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Direct Live Sync: If this document has an active public share, update the share record as well
    if (updatedDoc.shareId) {
      await db.collection<ShareDocument>('shares').updateOne(
        { _id: updatedDoc.shareId },
        {
          $set: {
            title: updatedDoc.title,
            content: updatedDoc.content,
            theme: updatedDoc.theme,
            updatedAt: updatedDoc.updatedAt,
          },
          $inc: { version: 1 },
        }
      );
    }

    return res.status(200).json({
      success: true,
      document: updatedDoc,
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /documents/:id - Delete document (and cleanup associated share)
apiRouter.delete('/documents/:id', requireAuth, docLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const doc = await db
      .collection<MarkdownDocument>('documents')
      .findOne({ _id: id, userId: req.user!.userId });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await db.collection<MarkdownDocument>('documents').deleteOne({ _id: id });

    // Clean up associated public share if it exists
    if (doc.shareId) {
      await db.collection<ShareDocument>('shares').deleteOne({ _id: doc.shareId });
    }

    return res.status(200).json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
});

// POST /documents/:id/share - Generate or get public share link for document
apiRouter.post('/documents/:id/share', requireAuth, docLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const doc = await db
      .collection<MarkdownDocument>('documents')
      .findOne({ _id: id, userId: req.user!.userId });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // If shareId already exists and share is in database, return it
    if (doc.shareId) {
      const existingShare = await db
        .collection<ShareDocument>('shares')
        .findOne({ _id: doc.shareId });
      if (existingShare) {
        return res.status(200).json({
          shareId: existingShare._id,
          version: existingShare.version,
        });
      }
    }

    // Create a new linked share record
    const newShareId = randomUUID();
    const shareDoc: ShareDocument = {
      _id: newShareId,
      documentId: doc._id,
      ownerUserId: req.user!.userId,
      title: doc.title,
      content: doc.content,
      theme: doc.theme,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection<ShareDocument>('shares').insertOne(shareDoc);

    // Link back to user document
    await db.collection<MarkdownDocument>('documents').updateOne(
      { _id: doc._id },
      { $set: { shareId: newShareId, isPublic: true, updatedAt: new Date() } }
    );

    return res.status(201).json({
      shareId: newShareId,
      version: shareDoc.version,
    });
  } catch (error) {
    console.error('Error generating share link for document:', error);
    return res.status(500).json({ error: 'Failed to create share link' });
  }
});

// ==============================================================================
// PUBLIC SHARES ROUTES (Guest & Authenticated)
// ==============================================================================

// POST /shares - Create a new public share document
apiRouter.post('/shares', shareCreateLimiter, optionalAuth, async (req: Request, res: Response) => {
  try {
    const { content, theme, title, documentId } = req.body || {};
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Content is required and must be a non-empty string.' });
    }

    const db = await getDb();
    const doc: ShareDocument = {
      _id: randomUUID(),
      documentId: typeof documentId === 'string' ? documentId : null,
      ownerUserId: req.user ? req.user.userId : null,
      title: typeof title === 'string' ? title.trim().slice(0, 200) : '',
      content,
      theme: typeof theme === 'string' && theme.trim() ? theme.trim() : 'professional',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection<ShareDocument>('shares').insertOne(doc);

    // If linked to a documentId owned by the user, update document.shareId
    if (doc.documentId && req.user) {
      await db.collection<MarkdownDocument>('documents').updateOne(
        { _id: doc.documentId, userId: req.user.userId },
        { $set: { shareId: doc._id, isPublic: true, updatedAt: new Date() } }
      );
    }

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
      documentId: doc.documentId || null,
      ownerUserId: doc.ownerUserId || null,
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

// PUT /shares/:id - Update content, theme, title, increment version (and sync to owner's document)
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

    const resultDoc: ShareDocument =
      rawResult && typeof rawResult === 'object' && 'value' in rawResult
        ? (rawResult as any).value
        : rawResult;

    if (!resultDoc) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Direct Live Sync: If this share is linked to an owner's document in the main database,
    // update the owner's document directly so changes reflect into the user's library immediately.
    if (resultDoc.documentId) {
      await db.collection<MarkdownDocument>('documents').updateOne(
        { _id: resultDoc.documentId },
        {
          $set: {
            content: resultDoc.content,
            theme: resultDoc.theme,
            title: resultDoc.title,
            updatedAt: resultDoc.updatedAt,
          },
          $inc: { version: 1 },
        }
      );
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

// ==============================================================================
// CONTACT MESSAGES ROUTE
// ==============================================================================

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
