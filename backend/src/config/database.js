import mongoose from "mongoose";

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(process.env.STORAGE_MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  });

  console.log("MongoDB connected successfully");
}

export default connectDatabase;