import { MongoClient } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClient?: MongoClient;
  mongoIndexesEnsured?: boolean;
};

export function getMongoClient() {
  if (globalForMongo.mongoClient) return globalForMongo.mongoClient;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  const client = new MongoClient(uri);
  globalForMongo.mongoClient = client;
  return client;
}

export function getDatabase() {
  const databaseName = process.env.MONGODB_DB?.trim();
  return getMongoClient().db(databaseName || undefined);
}

/**
 * Creates compound indexes the first time it is called per process lifetime.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function ensureIndexes() {
  if (globalForMongo.mongoIndexesEnsured) return;
  globalForMongo.mongoIndexesEnsured = true;
  try {
    const db = getDatabase();
    const conversations = db.collection("conversations");
    await Promise.all([
      // Fast per-user list sorted by recency
      conversations.createIndex({ userId: 1, updatedAt: -1 }, { background: true }),
      // Fast per-user list sorted by pinned-then-manual-order
      conversations.createIndex({ userId: 1, pinned: -1, order: -1 }, { background: true }),
      // Fast single-conversation lookup
      conversations.createIndex({ conversationId: 1, userId: 1 }, { unique: true, background: true }),
    ]);
  } catch (error) {
    // Non-fatal: indexes are a performance aid, not a correctness requirement
    console.warn("Could not ensure MongoDB indexes.", error);
    globalForMongo.mongoIndexesEnsured = false;
  }
}