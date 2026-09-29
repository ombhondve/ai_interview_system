import crypto from "crypto";
import {
    generateAIResponse,
    generateWhatsAppChatResponse
} from "../ai/ai.service.js";
import { resumeAnalysisPrompt, whatsappChatPrompt  } from "../ai/ai.prompt.js";
import { extractTextFromPDF } from "../resume/resume.parser.js";
import { createCandidate, findCandidateByPhone } from "../candidate/candidate.service.js";
import {
    downloadWhatsAppMedia,
    uploadResumeToCloudinary,
    sendWhatsAppMessage
} from "./whatsapp.service.js";


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

    return res.sendStatus(403);
};
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

    console.log("Approval WhatsApp message sent:", result);

    return result;
  } catch (error) {
    console.error("Failed to send approval WhatsApp message:", error);
    throw error;
  }
}

export const handleWebhook = async (req, res) => {

    try {

        console.log("\n========== WHATSAPP WEBHOOK ==========");

        const value =
            req.body?.entry?.[0]?.changes?.[0]?.value;


        // Support both incoming messages and message echoes
        const message =
            value?.messages?.[0] ||
            value?.message_echoes?.[0];


        if (!message) {

            console.log(
                "No message found in the webhook payload"
            );

            return res.sendStatus(200);
        }

        // TEXT MESSAGE

        if (message.type === "text") {
          const messages = [
                {
                    role: "system",
                    content: whatsappChatPrompt
                },
                {
                    role: "user",
                    content: message.text.body
                }
            ];

            const aiResult = await generateWhatsAppChatResponse(messages);
            await sendWhatsAppMessage(
                message.from,
                aiResult
            );
            console.log("AI Result:", aiResult);

            return res.sendStatus(200);
        }

        // DOCUMENT

        if (message.type === "document") {

            const document =
                message.document;

            
            if (!document) {

                await sendWhatsAppMessage(
                    message.from,
                    "Document information missing please Check the file and send again"
                );

                return res.sendStatus(200);
            }

            // CHECK PDF

            if (
                document.mime_type !==
                "application/pdf"
            ) {

                await sendWhatsAppMessage(
                    message.from,
                    "Rejected: File is not PDF"
                );

                return res.sendStatus(200);
            }

            // DOWNLOAD PDF FROM JALPI
            const pdfBuffer =
                await downloadWhatsAppMedia(
                    document.id
                );
            console.log(
                "PDF size:",
                pdfBuffer.length,
                "bytes"
            );

            // CHECK FILE SIZE

            const MAX_FILE_SIZE =
                10 * 1024 * 1024;


            if (
                pdfBuffer.length === 0
            ) {

                await sendWhatsAppMessage(
                    message.from,
                    "The PDF is empty or could not be downloaded. Please check the file and send again."
                );

                return res.sendStatus(200);
            }


            if (
                pdfBuffer.length >
                MAX_FILE_SIZE
            ) {

                await sendWhatsAppMessage(
                    message.from,
                    "pdf file size exceeds the 10MB limit. Please send a smaller file."
                );
                return res.sendStatus(200);
            }

            // CHECK PDF SIGNATURE
         
            const pdfHeader =
                pdfBuffer
                    .subarray(0, 5)
                    .toString("ascii");


            if (pdfHeader !== "%PDF-") {
                await sendWhatsAppMessage(
                    message.from,
                    "invalid PDF file. Please check the file and send again."
                );
                return res.sendStatus(200);
            }
            //sending file for text extraction 
           const extractedText = await extractTextFromPDF(pdfBuffer);
            console.log(extractedText);
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

           const aiResult = await generateAIResponse(messages);

            console.log("========== AI RESULT ==========");
            console.log("Type:", typeof aiResult);
            console.log("Length:", aiResult?.length);
            console.log(aiResult);
            console.log("================================");

            if (!aiResult || !aiResult.trim()) {
                throw new Error("Groq returned an empty response");
            }

            let result;

            try {
                // Remove markdown code fences if Groq happens to return them
                const cleanResult = aiResult
                    .trim()
                    .replace(/^```json\s*/i, "")
                    .replace(/^```\s*/i, "")
                    .replace(/\s*```$/i, "")
                    .trim();

                result = JSON.parse(cleanResult);

            } catch (error) {

                console.error("========== GROQ JSON PARSE ERROR ==========");
                console.error("Raw AI response:");
                console.error(aiResult);
                console.error("============================================");

                throw new Error(
                    "Groq returned invalid or incomplete JSON"
                );
            }

            const formattedPhone = `+${message.from}`;

            const existingCandidate =false
 /*               await findCandidateByPhone(
                    formattedPhone,
                    result.candidate?.email
                );*/
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

            // CHECK EXTRACTED TEXT
            if (result.isResume === false) {
                  await sendWhatsAppMessage(
                      message.from,
                      result.reason
                  );

                  return res.sendStatus(200);
              }
            else if (result.hasProblem === true && result.isResume === true) {
                  await sendWhatsAppMessage(
                      message.from,
                      result.reason
                  );
              }
            else{

                // =================================================
                // UPLOAD RESUME TO CLOUDINARY
                // =================================================

                const uniqueId = crypto.randomUUID();
                const safeFilename = "resume_" + uniqueId + ".pdf";

                const cloudinaryResult =
                    await uploadResumeToCloudinary(
                        pdfBuffer,
                        safeFilename
                    );

                result.resumeFileName = safeFilename;
                result.resumeUrl = cloudinaryResult.secure_url;

                console.log(
                    "Resume uploaded to Cloudinary:",
                    cloudinaryResult.secure_url
                );
                console.log(
                    filePath
                );
                result.candidate.phone = formattedPhone;
                result.activity = [
                    {
                        id: crypto.randomUUID(),
                        label: "Resume Received",
                        description: "Resume received through WhatsApp",
                        state: "complete"
                    }
                ]
                await createCandidate(result);
                console.log(result);
                await sendWhatsAppMessage(
                    message.from,
                    result.reason
                );
       
            }
            
            
          }
        return res.sendStatus(200);


    } catch (error) {

        console.error(
            "Webhook error:",
            error.response?.data ||
            error.message
        );

        return res.sendStatus(500);
    }
};