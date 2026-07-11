import { MongoClient } from "mongodb";

/** Cached MongoDB client singleton — getDb() is what every route/script actually calls. */

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "Missing MONGODB_URI environment variable. Copy .env.example to .env.local and fill in your MongoDB Atlas connection string.",
  );
}

/**
 * In dev, Next.js hot-reloads modules on every edit, which would otherwise
 * create a new MongoClient (and a new connection pool) each time. Caching
 * the client on the Node global survives module reloads, so the connection
 * pool is reused instead of exhausted.
 */
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = new MongoClient(uri).connect();
}

export default clientPromise;

export async function getDb() {
  const client = await clientPromise;
  return client.db("cv");
}
