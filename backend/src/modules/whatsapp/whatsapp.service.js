import axios from "axios";
import crypto from "node:crypto";
import cloudinary from "../../config/cloudinary.js";


const JALPI_API_URL =
    "https://app.jalpi.com/api/v1/getwabamedia";

const JALPI_SEND_MESSAGE_URL =
    "https://app.jalpi.com/api/v1/SendUserInitiatedmsg";

const MAX_RESUME_SIZE =
    10 * 1024 * 1024;


/*
|--------------------------------------------------------------------------
| Download WhatsApp Media
|--------------------------------------------------------------------------
*/

export const downloadWhatsAppMedia = async (mediaId) => {

    if (!mediaId) {
        throw new Error(
            "WhatsApp media ID is missing."
        );
    }

    if (!process.env.JALPI_API_KEY) {
        throw new Error(
            "JALPI_API_KEY is not configured."
        );
    }

    try {

        const response = await axios.get(
            JALPI_API_URL,
            {
                params: {
                    key: process.env.JALPI_API_KEY,
                    mediaid: mediaId
                },

                responseType: "arraybuffer",

                timeout: 30_000,

                maxContentLength:
                    MAX_RESUME_SIZE,

                maxBodyLength:
                    MAX_RESUME_SIZE
            }
        );


        /*
        |--------------------------------------------------------------------------
        | Convert response to Buffer
        |--------------------------------------------------------------------------
        */

        const pdfBuffer =
            Buffer.isBuffer(response.data)
                ? response.data
                : Buffer.from(response.data);


        /*
        |--------------------------------------------------------------------------
        | Validate downloaded file
        |--------------------------------------------------------------------------
        */

        if (
            !pdfBuffer ||
            pdfBuffer.length === 0
        ) {
            throw new Error(
                "JALPI returned an empty media file."
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Validate file size
        |--------------------------------------------------------------------------
        */

        if (
            pdfBuffer.length >
            MAX_RESUME_SIZE
        ) {
            throw new Error(
                "Downloaded resume exceeds the 10MB limit."
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Validate PDF signature
        |--------------------------------------------------------------------------
        */

        const pdfHeader =
            pdfBuffer
                .subarray(0, 5)
                .toString("ascii");


        if (pdfHeader !== "%PDF-") {
            throw new Error(
                "Downloaded WhatsApp media is not a valid PDF."
            );
        }


        console.log(
            `WhatsApp PDF downloaded successfully: ${pdfBuffer.length} bytes`
        );


        return pdfBuffer;

    } catch (error) {

        console.error(
            "JALPI Media Download Error:",
            error.response?.data ||
            error.message
        );

        throw error;
    }
};


/*
|--------------------------------------------------------------------------
| Upload Resume PDF to Cloudinary
|--------------------------------------------------------------------------
*/

export const uploadResumeToCloudinary = async (
    pdfBuffer,
    filename
) => {

    /*
    |--------------------------------------------------------------------------
    | Validate buffer
    |--------------------------------------------------------------------------
    */

    if (
        !Buffer.isBuffer(pdfBuffer) ||
        pdfBuffer.length === 0
    ) {
        throw new Error(
            "Resume PDF buffer is empty."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Validate file size
    |--------------------------------------------------------------------------
    */

    if (
        pdfBuffer.length >
        MAX_RESUME_SIZE
    ) {
        throw new Error(
            "Resume PDF exceeds the 10MB limit."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Validate PDF
    |--------------------------------------------------------------------------
    */

    const pdfHeader =
        pdfBuffer
            .subarray(0, 5)
            .toString("ascii");


    if (pdfHeader !== "%PDF-") {
        throw new Error(
            "Only valid PDF files can be uploaded."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Validate Cloudinary configuration
    |--------------------------------------------------------------------------
    */

    if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
    ) {
        throw new Error(
            "Cloudinary environment variables are not configured."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Generate safe unique public ID
    |--------------------------------------------------------------------------
    */

    const safeFilename =
        String(
            filename ||
            `resume_${crypto.randomUUID()}.pdf`
        )
            .replace(
                /\.pdf$/i,
                ""
            )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "_"
            );


    const publicId =
        safeFilename ||
        `resume_${crypto.randomUUID()}`;


    /*
    |--------------------------------------------------------------------------
    | Upload to Cloudinary
    |--------------------------------------------------------------------------
    */

    return new Promise(
        (resolve, reject) => {

            const uploadStream =
                cloudinary.uploader.upload_stream(
                    {
                        resource_type: "raw",

                        type: "upload",

                        folder:
                            "recruitai/resumes",

                        public_id:
                            publicId,

                        format: "pdf",

                        overwrite: false,

                        use_filename: false,

                        unique_filename: false,

                        context: {
                            source:
                                "whatsapp"
                        }
                    },

                    (
                        error,
                        result
                    ) => {

                        if (error) {

                            console.error(
                                "Cloudinary Resume Upload Error:",
                                error
                            );

                            reject(error);

                            return;
                        }


                        if (
                            !result ||
                            !result.secure_url
                        ) {

                            reject(
                                new Error(
                                    "Cloudinary did not return a secure resume URL."
                                )
                            );

                            return;
                        }


                        console.log(
                            "Cloudinary resume upload successful:",
                            result.secure_url
                        );


                        resolve(result);
                    }
                );


            uploadStream.once(
                "error",
                reject
            );


            uploadStream.end(
                pdfBuffer
            );
        }
    );
};


/*
|--------------------------------------------------------------------------
| Send WhatsApp Message
|--------------------------------------------------------------------------
*/

export const sendWhatsAppMessage = async (
    phone,
    message
) => {

    /*
    |--------------------------------------------------------------------------
    | Validate input
    |--------------------------------------------------------------------------
    */

    if (!phone) {
        throw new Error(
            "WhatsApp recipient phone number is missing."
        );
    }


    if (
        !message ||
        !String(message).trim()
    ) {
        throw new Error(
            "WhatsApp message cannot be empty."
        );
    }


    if (!process.env.JALPI_API_KEY) {
        throw new Error(
            "JALPI_API_KEY is not configured."
        );
    }


    try {

        const response =
            await axios.post(
                JALPI_SEND_MESSAGE_URL,

                {
                    key:
                        process.env.JALPI_API_KEY,

                    to:
                        String(phone),

                    type:
                        "text",

                    text: {
                        preview_url:
                            false,

                        body:
                            String(message)
                    }
                },

                {
                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    timeout:
                        30_000
                }
            );


        console.log(
            "JALPI message response:",
            response.data
        );


        return response.data;

    } catch (error) {

        console.error(
            "JALPI Send Message Error:",
            error.response?.data ||
            error.message
        );

        throw error;
    }
};