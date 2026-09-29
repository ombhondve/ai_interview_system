import crypto from "crypto";

import {
    generateAIResponse,
    generateWhatsAppChatResponse
} from "../ai/ai.service.js";

import {
    resumeAnalysisPrompt,
    whatsappChatPrompt
} from "../ai/ai.prompt.js";

import { extractTextFromPDF } from "../resume/resume.parser.js";

import {
    createCandidate,
    findCandidateByPhone
} from "../candidate/candidate.service.js";

import {
    downloadWhatsAppMedia,
    uploadResumeToCloudinary,
    sendWhatsAppMessage
} from "./whatsapp.service.js";


/*
|--------------------------------------------------------------------------
| WhatsApp Webhook Verification
|--------------------------------------------------------------------------
*/

export const verifyWebhook = (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (
        mode === "subscribe" &&
        token === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
        console.log("WhatsApp webhook verified");

        return res
            .status(200)
            .send(challenge);
    }

    console.error("WhatsApp webhook verification failed");

    return res.sendStatus(403);
};


/*
|--------------------------------------------------------------------------
| Send Candidate Portal URL
|--------------------------------------------------------------------------
*/

export async function URLsender(phoneNumber, url, name) {
    try {
        const message = `Hello ${name},

Your application has been approved for the next stage of the recruitment process.

Please select your interview slot using the link below:

🔗 Candidate Portal
${url}

Please complete your slot selection before the link expires.

Important:
• This link is unique to you.
• Please do not share it with anyone.
• This is an automated message. Please do not reply.

For any questions, please contact the recruitment team through the official communication channel.

Regards,
RecruitAI Team`;

        const result = await sendWhatsAppMessage(
            phoneNumber,
            message
        );

        console.log(
            "Approval WhatsApp message sent:",
            result
        );

        return result;

    } catch (error) {
        console.error(
            "Failed to send approval WhatsApp message:",
            error
        );

        throw error;
    }
}


/*
|--------------------------------------------------------------------------
| Main WhatsApp Webhook
|--------------------------------------------------------------------------
*/

export const handleWebhook = async (req, res) => {
    try {

        console.log("\n========== WHATSAPP WEBHOOK ==========");

        console.log("METHOD:", req.method);

        console.log(
            "HEADERS:",
            JSON.stringify(req.headers, null, 2)
        );

        console.log(
            "BODY:",
            JSON.stringify(req.body, null, 2)
        );

        const value =
            req.body?.entry?.[0]?.changes?.[0]?.value;

        const message =
            value?.messages?.[0] ||
            value?.message_echoes?.[0];

        // ...

        if (!message) {

            console.log(
                "No message found in the webhook payload"
            );

            return res.sendStatus(200);
        }


        /*
        |--------------------------------------------------------------------------
        | TEXT MESSAGE
        |--------------------------------------------------------------------------
        */

        if (message.type === "text") {

            const text =
                message.text?.body?.trim();

            if (!text) {
                return res.sendStatus(200);
            }

            const messages = [
                {
                    role: "system",
                    content: whatsappChatPrompt
                },
                {
                    role: "user",
                    content: text
                }
            ];

            const aiResult =
                await generateWhatsAppChatResponse(
                    messages
                );

            if (aiResult) {
                await sendWhatsAppMessage(
                    message.from,
                    aiResult
                );
            }

            console.log(
                "AI Result:",
                aiResult
            );

            return res.sendStatus(200);
        }


        /*
        |--------------------------------------------------------------------------
        | DOCUMENT MESSAGE
        |--------------------------------------------------------------------------
        */

        if (message.type === "document") {

            const document =
                message.document;

            /*
            |--------------------------------------------------------------------------
            | Validate document object
            |--------------------------------------------------------------------------
            */

            if (!document) {

                await sendWhatsAppMessage(
                    message.from,
                    "Document information is missing. Please check the file and send it again."
                );

                return res.sendStatus(200);
            }


            /*
            |--------------------------------------------------------------------------
            | Only PDF files are accepted
            |--------------------------------------------------------------------------
            */

            if (
                document.mime_type !==
                "application/pdf"
            ) {

                await sendWhatsAppMessage(
                    message.from,
                    "Rejected: Only PDF resume files are accepted. Please send your resume as a PDF."
                );

                return res.sendStatus(200);
            }


            /*
            |--------------------------------------------------------------------------
            | Download PDF from WhatsApp/Jalpi
            |--------------------------------------------------------------------------
            */

            const pdfBuffer =
                await downloadWhatsAppMedia(
                    document.id
                );

            console.log(
                "PDF size:",
                pdfBuffer?.length,
                "bytes"
            );


            /*
            |--------------------------------------------------------------------------
            | Validate downloaded buffer
            |--------------------------------------------------------------------------
            */

            if (
                !Buffer.isBuffer(pdfBuffer) ||
                pdfBuffer.length === 0
            ) {

                await sendWhatsAppMessage(
                    message.from,
                    "The PDF is empty or could not be downloaded. Please check the file and send it again."
                );

                return res.sendStatus(200);
            }


            /*
            |--------------------------------------------------------------------------
            | Maximum file size = 10 MB
            |--------------------------------------------------------------------------
            */

            const MAX_FILE_SIZE =
                10 * 1024 * 1024;

            if (
                pdfBuffer.length >
                MAX_FILE_SIZE
            ) {

                await sendWhatsAppMessage(
                    message.from,
                    "The PDF file size exceeds the 10MB limit. Please send a smaller resume."
                );

                return res.sendStatus(200);
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

                await sendWhatsAppMessage(
                    message.from,
                    "Invalid PDF file. Please check your resume and send the PDF again."
                );

                return res.sendStatus(200);
            }


            /*
            |--------------------------------------------------------------------------
            | Extract resume text
            |--------------------------------------------------------------------------
            */

            console.log(
                "Extracting resume text..."
            );

            const extractedText =
                await extractTextFromPDF(
                    pdfBuffer
                );

            if (
                !extractedText ||
                !extractedText.trim()
            ) {

                await sendWhatsAppMessage(
                    message.from,
                    "We could not read any text from your resume. Please send a clear PDF resume and try again."
                );

                return res.sendStatus(200);
            }

            console.log(
                "Resume text extracted successfully."
            );


            /*
            |--------------------------------------------------------------------------
            | Send resume to AI
            |--------------------------------------------------------------------------
            */

            const messages = [
                {
                    role: "system",
                    content: resumeAnalysisPrompt
                },
                {
                    role: "user",
                    content: extractedText
                }
            ];

            console.log(
                "Sending resume to AI..."
            );

            const aiResult =
                await generateAIResponse(
                    messages
                );


            /*
            |--------------------------------------------------------------------------
            | Validate AI response
            |--------------------------------------------------------------------------
            */

            console.log(
                "========== AI RESULT =========="
            );

            console.log(
                "Type:",
                typeof aiResult
            );

            console.log(
                "Length:",
                aiResult?.length
            );

            console.log(
                aiResult
            );

            console.log(
                "================================"
            );

            if (
                !aiResult ||
                typeof aiResult !== "string" ||
                !aiResult.trim()
            ) {
                throw new Error(
                    "AI returned an empty response."
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Parse AI JSON
            |--------------------------------------------------------------------------
            */

            let result;

            try {

                let cleanResult =
                    aiResult.trim();

                /*
                Remove ```json ... ```
                */

                cleanResult =
                    cleanResult
                        .replace(
                            /^```json\s*/i,
                            ""
                        )
                        .replace(
                            /^```\s*/i,
                            ""
                        )
                        .replace(
                            /\s*```$/i,
                            ""
                        )
                        .trim();

                result =
                    JSON.parse(
                        cleanResult
                    );

            } catch (error) {

                console.error(
                    "========== AI JSON PARSE ERROR =========="
                );

                console.error(
                    "Raw AI response:"
                );

                console.error(
                    aiResult
                );

                console.error(
                    "=========================================="
                );

                throw new Error(
                    "AI returned invalid or incomplete JSON."
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Validate AI result object
            |--------------------------------------------------------------------------
            */

            if (
                !result ||
                typeof result !== "object" ||
                Array.isArray(result)
            ) {
                throw new Error(
                    "AI returned an invalid result structure."
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Format phone number
            |--------------------------------------------------------------------------
            */

            const rawPhone =
                String(
                    message.from || ""
                ).trim();

            if (!rawPhone) {

                throw new Error(
                    "WhatsApp sender phone number is missing."
                );
            }

            const formattedPhone =
                rawPhone.startsWith("+")
                    ? rawPhone
                    : `+${rawPhone}`;


            /*
            |--------------------------------------------------------------------------
            | Make sure candidate object exists
            |--------------------------------------------------------------------------
            */

            result.candidate =
                result.candidate &&
                typeof result.candidate === "object"
                    ? result.candidate
                    : {};


            /*
            |--------------------------------------------------------------------------
            | Always use WhatsApp phone number
            |--------------------------------------------------------------------------
            */

            result.candidate.phone =
                formattedPhone;


            /*
            |--------------------------------------------------------------------------
            | CHECK IF THIS IS A RESUME
            |--------------------------------------------------------------------------
            */

            if (result.isResume === false) {

                await sendWhatsAppMessage(
                    message.from,
                    result.reason ||
                    "The uploaded file does not appear to be a valid resume. Please send your resume as a PDF."
                );

                return res.sendStatus(200);
            }


            /*
            |--------------------------------------------------------------------------
            | CHECK RESUME PROBLEMS
            |--------------------------------------------------------------------------
            */

            if (result.hasProblem === true) {

                await sendWhatsAppMessage(
                    message.from,
                    result.reason ||
                    "There is a problem with your resume. Please check the resume and send it again."
                );

                return res.sendStatus(200);
            }


            /*
            |--------------------------------------------------------------------------
            | CHECK DUPLICATE CANDIDATE
            |--------------------------------------------------------------------------
            */

            const existingCandidate =
                await findCandidateByPhone(
                    formattedPhone,
                    result.candidate?.email
                );


            if (existingCandidate) {

                console.log(
                    "Candidate already exists:",
                    existingCandidate._id
                );

                await sendWhatsAppMessage(
                    message.from,
                    "You have already applied. We have already received your resume."
                );

                return res.sendStatus(200);
            }


            /*
            |--------------------------------------------------------------------------
            | Upload resume to Cloudinary
            |--------------------------------------------------------------------------
            */

            console.log(
                "Uploading resume to Cloudinary..."
            );

            const uniqueId =
                crypto.randomUUID();

            const safeFilename =
                `resume_${uniqueId}.pdf`;

            const cloudinaryResult =
                await uploadResumeToCloudinary(
                    pdfBuffer,
                    safeFilename
                );


            /*
            |--------------------------------------------------------------------------
            | Validate Cloudinary response
            |--------------------------------------------------------------------------
            */

            if (
                !cloudinaryResult ||
                !cloudinaryResult.secure_url
            ) {

                throw new Error(
                    "Resume upload to Cloudinary failed: secure URL was not returned."
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Save Cloudinary information
            |--------------------------------------------------------------------------
            */

            result.resumeFileName =
                safeFilename;

            result.resumeUrl =
                cloudinaryResult.secure_url;


            console.log(
                "Resume uploaded to Cloudinary:",
                cloudinaryResult.secure_url
            );


            /*
            |--------------------------------------------------------------------------
            | Add candidate activity
            |--------------------------------------------------------------------------
            */

            result.activity = [
                {
                    id: crypto.randomUUID(),
                    label: "Resume Received",
                    description:
                        "Resume received through WhatsApp",
                    state: "complete"
                }
            ];


            /*
            |--------------------------------------------------------------------------
            | Create candidate in MongoDB
            |--------------------------------------------------------------------------
            */

            console.log(
                "Creating candidate in MongoDB..."
            );

            const createdCandidate =
                await createCandidate(
                    result
                );


            console.log(
                "Candidate created successfully:",
                createdCandidate?._id
            );


            /*
            |--------------------------------------------------------------------------
            | Send SUCCESS WhatsApp message
            |--------------------------------------------------------------------------
            */

            const successMessage =
                "Your resume has been received successfully. Our recruitment team will review your application and contact you shortly.";

            await sendWhatsAppMessage(
                message.from,
                successMessage
            );


            console.log(
                "Resume processing completed successfully."
            );

            return res.sendStatus(200);
        }


        /*
        |--------------------------------------------------------------------------
        | Unsupported message type
        |--------------------------------------------------------------------------
        */

        console.log(
            "Unsupported WhatsApp message type:",
            message.type
        );

        return res.sendStatus(200);


    } catch (error) {

        console.error(
            "\n========== WHATSAPP WEBHOOK ERROR =========="
        );

        console.error(
            error?.response?.data ||
            error?.stack ||
            error?.message ||
            error
        );

        console.error(
            "=============================================\n"
        );

        /*
        |--------------------------------------------------------------------------
        | We don't expose internal errors to the candidate.
        |--------------------------------------------------------------------------
        */

        try {

            if (req.body?.entry?.[0]?.changes?.[0]?.value) {

                const value =
                    req.body.entry[0]
                        .changes[0]
                        .value;

                const message =
                    value?.messages?.[0];

                if (message?.from) {

                    await sendWhatsAppMessage(
                        message.from,
                        "We could not process your resume right now. Please try again in a few minutes."
                    );
                }
            }

        } catch (messageError) {

            console.error(
                "Failed to send error WhatsApp message:",
                messageError
            );
        }

        return res.sendStatus(500);
    }
};