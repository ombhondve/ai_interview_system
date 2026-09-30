import "dotenv/config";
import bcrypt from "bcrypt";

import app from "./app.js";
import connectDatabase from "./config/database.js";
import Admin from "./modules/admin/admin.model.js";

const PORT = process.env.PORT || 5000;

async function initializeDefaultAdmin() {
  try {
    const defaultAdminEmail = "admin@gmail.com";
    const defaultAdminPassword = "admin@123";
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: defaultAdminEmail });
    
    if (existingAdmin) {
      console.log(`✅ Default admin account already exists: ${defaultAdminEmail}`);
      return;
    }
    
    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(defaultAdminPassword, saltRounds);
    
    // Create default admin
    const defaultAdmin = new Admin({
      name: "System Administrator",
      email: defaultAdminEmail,
      passwordHash: passwordHash,
      role: "superadmin"
    });
    
    await defaultAdmin.save();
    console.log(`✅ Default admin account created successfully`);
    console.log(`   Email: ${defaultAdminEmail}`);
    console.log(`   Password: ${defaultAdminPassword}`);
    console.log(`   Role: superadmin`);
    
  } catch (error) {
    console.error("❌ Failed to create default admin account:", error.message);
    console.log("⚠️  You may need to create admin account manually");
  }
}

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    console.log("✅ MongoDB connected successfully");
    
    // Initialize default admin account
    await initializeDefaultAdmin();
    
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

startServer();