import { MongoClient, Db } from 'mongodb';
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
      if (typeof (process as any).loadEnvFile === 'function') {
        try {
          (process as any).loadEnvFile(envPath);
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
          // Ignore and check next path
        }
      }
    }
  }
}

export interface CachedMongo {
  client: MongoClient | null;
  db: Db | null;
  promise: Promise<{ client: MongoClient; db: Db }> | null;
}

declare global {
  // Global cache across serverless invocations (e.g. Vercel)
  // eslint-disable-next-line no-var
  var _mongoCache: CachedMongo | undefined;
}

export function getMongoCache(): CachedMongo {
  if (!global._mongoCache) {
    global._mongoCache = {
      client: null,
      db: null,
      promise: null,
    };
  }
  return global._mongoCache;
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const cache = getMongoCache();

  if (cache.client && cache.db) {
    return { client: cache.client, db: cache.db };
  }

  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB_NAME || 'md2pdf';

    if (!uri) {
      throw new Error('Please define the MONGODB_URI environment variable inside .env or server environment.');
    }

    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    cache.promise = client
      .connect()
      .then((connectedClient) => {
        const db = connectedClient.db(dbName);
        cache.client = connectedClient;
        cache.db = db;
        return { client: connectedClient, db };
      })
      .catch((error) => {
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

export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}
