import assert from 'node:assert/strict';
import http from 'node:http';
import { PassThrough } from 'node:stream';
import app from '../server/app.js';
import { createSessionToken } from '../server/auth.js';

// Setup in-memory mock for MongoDB
const mockShares = new Map();
const mockDocuments = new Map();
const mockUsers = new Map();
const mockContact = [];

const mockDb = {
  collection(name) {
    if (name === 'shares') {
      return {
        async insertOne(doc) {
          mockShares.set(doc._id, { ...doc });
          return { acknowledged: true, insertedId: doc._id };
        },
        async findOne(query) {
          const doc = mockShares.get(query._id);
          return doc ? { ...doc } : null;
        },
        async findOneAndUpdate(filter, update, options) {
          const existing = mockShares.get(filter._id);
          if (!existing) return null;

          const updated = { ...existing };
          if (update.$set) {
            Object.assign(updated, update.$set);
          }
          if (update.$inc) {
            for (const [key, val] of Object.entries(update.$inc)) {
              updated[key] = (updated[key] || 0) + val;
            }
          }
          mockShares.set(filter._id, updated);
          return options?.returnDocument === 'after' ? { ...updated } : { ...existing };
        },
        async updateOne(filter, update) {
          const existing = mockShares.get(filter._id);
          if (!existing) return { modifiedCount: 0 };
          if (update.$set) Object.assign(existing, update.$set);
          if (update.$inc) {
            for (const [key, val] of Object.entries(update.$inc)) {
              existing[key] = (existing[key] || 0) + val;
            }
          }
          mockShares.set(filter._id, existing);
          return { modifiedCount: 1 };
        },
        async deleteOne(filter) {
          const existed = mockShares.delete(filter._id);
          return { deletedCount: existed ? 1 : 0 };
        },
      };
    }
    if (name === 'documents') {
      return {
        async insertOne(doc) {
          mockDocuments.set(doc._id, { ...doc });
          return { acknowledged: true, insertedId: doc._id };
        },
        find(filter, options) {
          const docs = Array.from(mockDocuments.values()).filter((d) => d.userId === filter.userId);
          return {
            sort() {
              return {
                async toArray() {
                  return docs.map((d) => {
                    const copy = { ...d };
                    if (options?.projection?.content === 0) delete copy.content;
                    return copy;
                  });
                },
              };
            },
          };
        },
        async findOne(filter) {
          const doc = mockDocuments.get(filter._id);
          if (!doc) return null;
          if (filter.userId && doc.userId !== filter.userId) return null;
          return { ...doc };
        },
        async findOneAndUpdate(filter, update, options) {
          const existing = mockDocuments.get(filter._id);
          if (!existing || (filter.userId && existing.userId !== filter.userId)) return null;

          const updated = { ...existing };
          if (update.$set) Object.assign(updated, update.$set);
          if (update.$inc) {
            for (const [key, val] of Object.entries(update.$inc)) {
              updated[key] = (updated[key] || 0) + val;
            }
          }
          mockDocuments.set(filter._id, updated);
          return options?.returnDocument === 'after' ? { ...updated } : { ...existing };
        },
        async updateOne(filter, update) {
          const existing = mockDocuments.get(filter._id);
          if (!existing) return { modifiedCount: 0 };
          if (filter.userId && existing.userId !== filter.userId) return { modifiedCount: 0 };
          if (update.$set) Object.assign(existing, update.$set);
          if (update.$inc) {
            for (const [key, val] of Object.entries(update.$inc)) {
              existing[key] = (existing[key] || 0) + val;
            }
          }
          mockDocuments.set(filter._id, existing);
          return { modifiedCount: 1 };
        },
        async deleteOne(filter) {
          const existed = mockDocuments.delete(filter._id);
          return { deletedCount: existed ? 1 : 0 };
        },
      };
    }
    if (name === 'users') {
      return {
        async findOne(query) {
          for (const u of mockUsers.values()) {
            if (query.googleId && u.googleId === query.googleId) return { ...u };
            if (query._id && u._id === query._id) return { ...u };
          }
          return null;
        },
        async findOneAndUpdate(filter, update) {
          let user = null;
          for (const u of mockUsers.values()) {
            if (filter.googleId && u.googleId === filter.googleId) {
              user = u;
              break;
            }
          }
          if (!user) {
            user = {
              _id: update.$setOnInsert?._id || 'user-1',
              googleId: filter.googleId,
              createdAt: update.$setOnInsert?.createdAt || new Date(),
            };
          }
          if (update.$set) Object.assign(user, update.$set);
          mockUsers.set(user._id, user);
          return { value: { ...user } };
        },
      };
    }
    if (name === 'contact_messages') {
      return {
        async insertOne(doc) {
          mockContact.push({ ...doc });
          return { acknowledged: true, insertedId: 'mock-contact-id' };
        },
      };
    }
    throw new Error(`Unexpected collection: ${name}`);
  },
};

// Inject mock into global._mongoCache
global._mongoCache = {
  client: {},
  db: mockDb,
  promise: Promise.resolve({ client: {}, db: mockDb }),
};

/**
 * In-memory HTTP request dispatcher for Express applications.
 * Executes through Express router and middleware pipeline with zero TCP sockets.
 */
function request(appInstance, { method = 'GET', url = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const socket = new PassThrough();
      socket.remoteAddress = '127.0.0.1';
      socket.destroy = () => {};

      const lowerHeaders = {};
      for (const [k, v] of Object.entries(headers)) {
        lowerHeaders[k.toLowerCase()] = v;
      }

      const req = new http.IncomingMessage(socket);
      req.method = method;
      req.url = url;
      req.headers = { host: 'localhost', ...lowerHeaders };
      req.socket = socket;
      req.connection = socket;

      const res = new http.ServerResponse(req);
      res.assignSocket(socket);

      let resBody = '';
      const resHeaders = {};

      const originalSetHeader = res.setHeader.bind(res);
      res.setHeader = (k, v) => {
        resHeaders[k.toLowerCase()] = v;
        return originalSetHeader(k, v);
      };

      res.write = (chunk) => {
        if (chunk) resBody += chunk.toString();
        return true;
      };

      res.end = (chunk) => {
        if (chunk) resBody += chunk.toString();
        resolve({
          status: res.statusCode,
          headers: {
            get: (name) => {
              const val = resHeaders[name.toLowerCase()] || res.getHeader(name);
              return val !== undefined && val !== null ? String(val) : null;
            },
          },
          text: async () => resBody,
          json: async () => (resBody ? JSON.parse(resBody) : null),
        });
      };

      if (body !== null && body !== undefined) {
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        if (!req.headers['content-type']) {
          req.headers['content-type'] = 'application/json';
        }
        req.headers['content-length'] = Buffer.byteLength(payload).toString();
        req.push(payload);
      }
      req.push(null);

      appInstance.handle(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

async function runTests() {
  console.log('🚀 Starting Express + MongoDB API test suite (in-memory)...\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Health check (prefixed and stripped)
  await test('GET /api/health returns 200 and ok status', async () => {
    const res = await request(app, { method: 'GET', url: '/api/health' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(typeof body.uptime === 'number');
    assert.ok(typeof body.timestamp === 'string');
  });

  await test('GET /health (stripped route) returns 200', async () => {
    const res = await request(app, { method: 'GET', url: '/health' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  // 2. Share creation
  let createdId = '';
  await test('POST /api/shares creates new share with version 1 and UUID', async () => {
    const res = await request(app, {
      method: 'POST',
      url: '/api/shares',
      headers: { 'Content-Type': 'application/json' },
      body: {
        content: '# Test Document',
        theme: 'modern',
        title: 'My Test Title',
      },
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id && typeof body.id === 'string');
    assert.equal(body.version, 1);
    createdId = body.id;

    // Verify stored doc in mock
    const stored = mockShares.get(createdId);
    assert.ok(stored, 'Stored document should exist in mockShares');
    assert.equal(stored.title, 'My Test Title');
    assert.equal(stored.theme, 'modern');
    assert.equal(stored.content, '# Test Document');
    assert.equal(stored.version, 1);
    assert.ok(stored.createdAt instanceof Date);
    assert.ok(stored.updatedAt instanceof Date);
  });

  await test('POST /api/shares validates empty content', async () => {
    const res = await request(app, {
      method: 'POST',
      url: '/api/shares',
      headers: { 'Content-Type': 'application/json' },
      body: {
        content: '   ',
      },
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  // 3. Share retrieval
  await test('GET /api/shares/:id returns 200 with document and ETag', async () => {
    const res = await request(app, { method: 'GET', url: `/api/shares/${createdId}` });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('etag'), 'W/"1"');
    assert.ok(res.headers.get('last-modified'));
    const body = await res.json();
    assert.equal(body.id, createdId);
    assert.equal(body.title, 'My Test Title');
    assert.equal(body.content, '# Test Document');
    assert.equal(body.version, 1);
  });

  await test('GET /api/shares/:id returns 404 for unknown ID', async () => {
    const res = await request(app, { method: 'GET', url: '/api/shares/non-existent-id' });
    assert.equal(res.status, 404);
  });

  // 4. Conditional polling with 304 Not Modified
  await test('GET /api/shares/:id?version=1 returns 304 Not Modified', async () => {
    const res = await request(app, { method: 'GET', url: `/api/shares/${createdId}?version=1` });
    assert.equal(res.status, 304);
    const text = await res.text();
    assert.equal(text, ''); // Empty body for 304
  });

  await test('GET /api/shares/:id with If-None-Match returns 304 Not Modified', async () => {
    const res = await request(app, {
      method: 'GET',
      url: `/api/shares/${createdId}`,
      headers: { 'If-None-Match': 'W/"1"' },
    });
    assert.equal(res.status, 304);
  });

  await test('GET /api/shares/:id with If-Modified-Since returns 304 Not Modified', async () => {
    const futureDate = new Date(Date.now() + 10000).toUTCString();
    const res = await request(app, {
      method: 'GET',
      url: `/api/shares/${createdId}`,
      headers: { 'If-Modified-Since': futureDate },
    });
    assert.equal(res.status, 304);
  });

  await test('GET /api/shares/:id?version=99 returns 200 (version changed)', async () => {
    const res = await request(app, { method: 'GET', url: `/api/shares/${createdId}?version=99` });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.version, 1);
  });

  // 5. Share update
  await test('PUT /api/shares/:id updates content and increments version', async () => {
    const res = await request(app, {
      method: 'PUT',
      url: `/api/shares/${createdId}`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        content: '# Updated Content',
        theme: 'minimal',
        title: 'Updated Title',
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.version, 2);

    const stored = mockShares.get(createdId);
    assert.ok(stored);
    assert.equal(stored.content, '# Updated Content');
    assert.equal(stored.title, 'Updated Title');
    assert.equal(stored.theme, 'minimal');
    assert.equal(stored.version, 2);
  });

  await test('PUT /api/shares/:id returns 404 for unknown ID', async () => {
    const res = await request(app, {
      method: 'PUT',
      url: '/api/shares/non-existent-id',
      headers: { 'Content-Type': 'application/json' },
      body: { content: 'test' },
    });
    assert.equal(res.status, 404);
  });

  // 6. Conditional polling after update
  await test('GET /api/shares/:id?version=1 now returns 200 (has new version 2)', async () => {
    const res = await request(app, { method: 'GET', url: `/api/shares/${createdId}?version=1` });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.version, 2);
    assert.equal(body.content, '# Updated Content');
  });

  await test('GET /api/shares/:id?version=2 now returns 304 Not Modified', async () => {
    const res = await request(app, { method: 'GET', url: `/api/shares/${createdId}?version=2` });
    assert.equal(res.status, 304);
  });

  // 7. Contact form validation and submission
  await test('POST /api/contact validates invalid email', async () => {
    const res = await request(app, {
      method: 'POST',
      url: '/api/contact',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: 'invalid-email',
        message: 'This is a valid test message with enough characters.',
      },
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('email'));
  });

  await test('POST /api/contact validates too-short message (<10 chars)', async () => {
    const res = await request(app, {
      method: 'POST',
      url: '/api/contact',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: 'user@example.com',
        message: 'short',
      },
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('10'));
  });

  await test('POST /api/contact validates too-long message (>5000 chars)', async () => {
    const res = await request(app, {
      method: 'POST',
      url: '/api/contact',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: 'user@example.com',
        message: 'a'.repeat(5001),
      },
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('5000'));
  });

  await test('POST /api/contact submits valid message with 201', async () => {
    const res = await request(app, {
      method: 'POST',
      url: '/api/contact',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: 'hello@example.com',
        message: 'This is a great tool, please keep it updated!',
      },
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(mockContact.length, 1);
    assert.equal(mockContact[0].email, 'hello@example.com');
    assert.equal(mockContact[0].message, 'This is a great tool, please keep it updated!');
    assert.ok(mockContact[0].createdAt instanceof Date);
  });

  // 8. Stripped serverless routes (for Vercel rewrites without /api prefix)
  await test('POST /shares (stripped route) creates share successfully', async () => {
    const res = await request(app, {
      method: 'POST',
      url: '/shares',
      headers: { 'Content-Type': 'application/json' },
      body: {
        content: '# Direct Route Document',
        theme: 'dracula',
        title: 'Direct Route Title',
      },
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
  });

  // 9. Authentication Routes
  await test('GET /api/auth/me returns 401 when not logged in', async () => {
    const res = await request(app, {
      method: 'GET',
      url: '/api/auth/me',
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.user, null);
  });

  const testUserToken = createSessionToken({
    userId: 'user-test-123',
    email: 'user@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
  });

  await test('GET /api/auth/me returns user profile when session token provided', async () => {
    const res = await request(app, {
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.userId, 'user-test-123');
    assert.equal(body.user.email, 'user@example.com');
  });

  // 10. Document Library CRUD & Direct Live Sync
  let createdDocId = '';
  await test('POST /api/documents creates private document for authenticated user', async () => {
    const res = await request(app, {
      method: 'POST',
      url: '/api/documents',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`,
      },
      body: {
        title: 'My Project Architecture',
        content: '# Architecture\n\nOverview of the system.',
        theme: 'ocean',
      },
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body._id);
    createdDocId = body._id;
    assert.equal(body.userId, 'user-test-123');
    assert.equal(body.title, 'My Project Architecture');
    assert.equal(body.theme, 'ocean');
  });

  await test('GET /api/documents lists user documents', async () => {
    const res = await request(app, {
      method: 'GET',
      url: '/api/documents',
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.documents));
    assert.equal(body.documents.length, 1);
    assert.equal(body.documents[0]._id, createdDocId);
    assert.equal(body.documents[0].title, 'My Project Architecture');
  });

  let linkedShareId = '';
  await test('POST /api/documents/:id/share publishes document and generates public shareId', async () => {
    const res = await request(app, {
      method: 'POST',
      url: `/api/documents/${createdDocId}/share`,
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.shareId);
    linkedShareId = body.shareId;
  });

  await test('Direct Live Sync: public edit via PUT /api/shares/:id automatically updates owner document in main db', async () => {
    // 1. Guest/public editor updates content via public link endpoint
    const res = await request(app, {
      method: 'PUT',
      url: `/api/shares/${linkedShareId}`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        content: '# Architecture\n\nUpdated by public collaborator via share link!',
        theme: 'dracula',
        title: 'My Project Architecture (Revised)',
      },
    });
    assert.equal(res.status, 200);

    // 2. Verify that owner document in documents collection was updated directly!
    const docCheckRes = await request(app, {
      method: 'GET',
      url: `/api/documents/${createdDocId}`,
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert.equal(docCheckRes.status, 200);
    const updatedDoc = await docCheckRes.json();
    assert.equal(
      updatedDoc.content,
      '# Architecture\n\nUpdated by public collaborator via share link!'
    );
    assert.equal(updatedDoc.theme, 'dracula');
    assert.equal(updatedDoc.title, 'My Project Architecture (Revised)');
  });

  console.log(`\n================================`);
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
