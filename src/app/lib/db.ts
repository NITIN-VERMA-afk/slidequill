import mongoose from "mongoose";

const cached = (global as any).mongoose ?? ((global as any).mongoose = { conn: null, promise: null });

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (mongoose.connection?.readyState === 1) {
    cached.conn = mongoose.connection;
    return cached.conn;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable.");
  }
  cached.promise ??= mongoose.connect(uri, { bufferCommands: false });
  cached.conn = await cached.promise;
  return cached.conn;
}