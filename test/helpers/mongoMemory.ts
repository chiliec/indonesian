import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let server: MongoMemoryServer | null = null;

export async function startMemoryMongo(): Promise<void> {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: 'test' });
}

export async function stopMemoryMongo(): Promise<void> {
  await mongoose.disconnect();
  if (server) await server.stop();
  server = null;
}

export async function clearMemoryMongo(): Promise<void> {
  const collections = await mongoose.connection.db?.collections();
  if (!collections) return;
  for (const c of collections) await c.deleteMany({});
  for (const name of mongoose.modelNames()) {
    await mongoose.model(name).syncIndexes();
  }
}
