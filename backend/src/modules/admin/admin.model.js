import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        passwordHash: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["superadmin", "recruiter"],
            required: true,
            default: "recruiter"
        },

        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
            index: true
        },

        lastLogin: {
            type: Date,
            default: null
        },

        avatar: {
            type: String,
            default: null,
            trim: true
        },

        phone: {
            type: String,
            default: "",
            trim: true
        }
    },
    {
        timestamps: true
    }
);

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;