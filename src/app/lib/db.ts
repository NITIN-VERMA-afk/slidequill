import mongoose from "mongoose";

const uri = process.env.MONGODB_URI!;
let cached = (global as any).mongoose ?? ((global as any).mongoose = { conn: null, promise: null });

export async function connectDB() {
  if (cached.conn) return cached.conn;
  cached.promise ??= mongoose.connect(uri, { bufferCommands: false });
  cached.conn = await cached.promise;
  return cached.conn;
}