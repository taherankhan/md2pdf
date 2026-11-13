import { MongoClient } from 'mongodb';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Automatically load .env file if MONGODB_URI is not set in the environment
if (!process.env.MONGODB_URI) {
  const candidatePaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'md2pdf', '.env'),
    fileURLToPath(new URL('../.env', import.meta.url)),
  ];
  for (const envPath of candidatePaths) {
    if (existsSync(envPath)) {
      if (typeof process.loadEnvFile === 'function') {
        try {
          process.loadEnvFile(envPath);
          if (process.env.MONGODB_URI) break;
        } catch {
          // Ignore and check next path
        }
      } else {
        try {
          const content = readFileSync(envPath, 'utf-8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
              const k = trimmed.slice(0, eqIdx).trim();
              const v = trimmed.slice(eqIdx + 1).trim();
              if (!process.env[k]) process.env[k] = v;
            }
          }
          if (process.env.MONGODB_URI) break;
        } catch {
          // Ignore
        }
      }
    }
  }
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'md2pdf';

if (!uri) {
  console.error('❌ MONGODB_URI is not set in environment or .env file');
  process.exit(1);
}

export async function initMongoDB() {
  console.log(`Connecting to MongoDB Atlas (database: ${dbName})...`);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  console.log('✅ Connected successfully.');

  const db = client.db(dbName);
  const existingCollections = await db.listCollections().toArray();
  const existingNames = new Set(existingCollections.map((c) => c.name));

  // 1. Setup 'shares' collection
  const sharesValidator = {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'content', 'version', 'createdAt', 'updatedAt'],
      properties: {
        _id: { bsonType: 'string', description: 'Unique share UUID string' },
        title: { bsonType: 'string', description: 'Document title' },
        content: { bsonType: 'string', description: 'Markdown content string' },
        theme: { bsonType: 'string', description: 'Editor theme identifier' },
        version: { bsonType: 'number', description: 'Revision version number' },
        createdAt: { bsonType: 'date', description: 'Creation timestamp' },
        updatedAt: { bsonType: 'date', description: 'Last modified timestamp' },
      },
    },
  };

  if (!existingNames.has('shares')) {
    console.log("Creating 'shares' collection with schema validator...");
    await db.createCollection('shares', { validator: sharesValidator });
  } else {
    console.log("Updating 'shares' collection schema validator...");
    try {
      await db.command({
        collMod: 'shares',
        validator: sharesValidator,
        validationLevel: 'moderate',
      });
    } catch (e) {
      console.warn('Notice on collMod shares:', e.message);
    }
  }

  console.log("Creating indexes on 'shares'...");
  await db.collection('shares').createIndex({ updatedAt: -1 }, { name: 'shares_updatedAt_desc' });
  await db.collection('shares').createIndex({ createdAt: -1 }, { name: 'shares_createdAt_desc' });

  // 2. Setup 'contact_messages' collection
  const contactValidator = {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'message', 'createdAt'],
      properties: {
        email: { bsonType: 'string', description: 'Sender email address' },
        message: { bsonType: 'string', description: 'Message content' },
        createdAt: { bsonType: 'date', description: 'Submission timestamp' },
      },
    },
  };

  if (!existingNames.has('contact_messages')) {
    console.log("Creating 'contact_messages' collection with schema validator...");
    await db.createCollection('contact_messages', { validator: contactValidator });
  } else {
    console.log("Updating 'contact_messages' collection schema validator...");
    try {
      await db.command({
        collMod: 'contact_messages',
        validator: contactValidator,
        validationLevel: 'moderate',
      });
    } catch (e) {
      console.warn('Notice on collMod contact_messages:', e.message);
    }
  }

  console.log("Creating indexes on 'contact_messages'...");
  await db.collection('contact_messages').createIndex({ createdAt: -1 }, { name: 'contact_createdAt_desc' });

  console.log('✅ MongoDB collections, validators, and indexes initialized successfully.');
  await client.close();
}

// Auto-run if executed directly
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('init-mongodb.mjs') || process.argv[1].endsWith('init-mongodb'));

if (isDirectRun) {
  initMongoDB().catch((err) => {
    console.error('❌ MongoDB initialization failed:', err);
    process.exit(1);
  });
}
