import mongoose from "mongoose";

let isConnected = false;
let connectionPromise = null;

async function connectDatabase() {
  // If already connected, return
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start new connection
  connectionPromise = mongoose.connect(process.env.STORAGE_MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10, // Limit connection pool for serverless
  }).then(() => {
    isConnected = true;
    console.log("✅ MongoDB connected successfully");
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
      connectionPromise = null;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
      connectionPromise = null;
    });
    
    return mongoose.connection;
  }).catch((error) => {
    console.error("❌ MongoDB connection failed:", error.message);
    connectionPromise = null;
    throw error;
  });

  return connectionPromise;
}

// Export both the function and a helper to check connection
export default connectDatabase;
export { isConnected };