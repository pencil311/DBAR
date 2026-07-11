import mongoose from "mongoose";
import { DEMO_MODE, ensureDemoSeed } from "@/lib/demo";

const DB_NAME = "dbar";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
  // eslint-disable-next-line no-var
  var _demoMongo: unknown;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

/** Start an ephemeral in-memory MongoDB (demo mode) and return its URI. */
async function startInMemoryMongo(): Promise<string> {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY;
  const mem = await MongoMemoryServer.create(
    systemBinary ? { binary: { systemBinary } } : undefined
  );
  global._demoMongo = mem; // keep a reference so it isn't garbage-collected
  return mem.getUri();
}

export async function connectToDatabase() {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = (async () => {
      const uri = DEMO_MODE ? await startInMemoryMongo() : process.env.MONGODB_URI;
      if (!uri) {
        throw new Error("Missing MONGODB_URI environment variable");
      }
      const conn = await mongoose.connect(uri, { dbName: DB_NAME });
      if (DEMO_MODE) await ensureDemoSeed();
      return conn;
    })();
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
