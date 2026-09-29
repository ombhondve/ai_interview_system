import axios from "axios";
import crypto from "node:crypto";
import cloudinary from "../../config/cloudinary.js";

const JALPI_API_URL =
    "https://app.jalpi.com/api/v1/getwabamedia";

export const downloadWhatsAppMedia = async (mediaId) => {
    try {

        const response = await axios.get(JALPI_API_URL, {
            params: {
                key: process.env.JALPI_API_KEY,
                mediaid: mediaId
            },
            responseType: "arraybuffer"
        });

        return response.data;

    } catch (error) {

        console.error(
            "JALPI Media Download Error:",
            error.response?.data || error.message
        );

        throw error;
    }
};


// =====================================================
// UPLOAD RESUME PDF TO CLOUDINARY
// =====================================================

export const uploadResumeToCloudinary = async (pdfBuffer, filename) => {
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
        throw new Error("Resume PDF buffer is empty.");
    }

    return new Promise((resolve, reject) => {
        const publicId = String(filename || ("resume_" + crypto.randomUUID() + ".pdf"))
            .replace(/\.pdf$/i, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_");

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: "raw",
                type: "upload",
                folder: "recruitai/resumes",
                public_id: publicId,
                format: "pdf",
                overwrite: true,
                use_filename: false,
                unique_filename: false,
            },
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }

                if (!result?.secure_url) {
                    reject(new Error("Cloudinary did not return a secure resume URL."));
                    return;
                }

                resolve(result);
            }
        );

        uploadStream.once("error", reject);
        uploadStream.end(pdfBuffer);
    });
};


const JALPI_SEND_MESSAGE_URL =
    "https://app.jalpi.com/api/v1/SendUserInitiatedmsg";

export const sendWhatsAppMessage = async (phone, message) => {
    try {
        const response = await axios.post(
            JALPI_SEND_MESSAGE_URL,
            {
                key: process.env.JALPI_API_KEY,
                to: phone,
                type: "text",
                text: {
                    preview_url: "false",
                    body: message
                }
            },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("JALPI response:");
        console.log(response.data);

        return response.data;

    } catch (error) {
        console.error(
            "JALPI Send Message Error:",
            error.response?.data || error.message
        );

        throw error;
    }
};