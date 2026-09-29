import { downloadWhatsAppMedia } from "./whatsapp.service.js";

export async function documentverification(document) {
    /*
    |--------------------------------------------------------------------------
    | Validate document
    |--------------------------------------------------------------------------
    */

    if (!document) {
        console.log(
            "Document information missing"
        );

        throw new Error(
            "Document information missing."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Log document information
    |--------------------------------------------------------------------------
    */

    console.log(
        "Filename:",
        document.filename
    );

    console.log(
        "MIME:",
        document.mime_type
    );

    console.log(
        "Media ID:",
        document.id
    );


    /*
    |--------------------------------------------------------------------------
    | Check PDF
    |--------------------------------------------------------------------------
    */

    if (
        document.mime_type !==
        "application/pdf"
    ) {
        console.log(
            "Rejected: File is not PDF"
        );

        throw new Error(
            "File is not a PDF."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Check Media ID
    |--------------------------------------------------------------------------
    */

    if (!document.id) {
        throw new Error(
            "WhatsApp media ID is missing."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Download PDF from Jalpi
    |--------------------------------------------------------------------------
    */

    const pdfBuffer =
        await downloadWhatsAppMedia(
            document.id
        );


    console.log(
        "PDF downloaded successfully"
    );

    console.log(
        "PDF size:",
        pdfBuffer.length,
        "bytes"
    );


    /*
    |--------------------------------------------------------------------------
    | Check file size
    |--------------------------------------------------------------------------
    */

    const MAX_FILE_SIZE =
        10 * 1024 * 1024;


    if (
        !Buffer.isBuffer(pdfBuffer) ||
        pdfBuffer.length === 0
    ) {
        console.log(
            "Rejected: Empty PDF"
        );

        throw new Error(
            "PDF is empty or could not be downloaded."
        );
    }


    if (
        pdfBuffer.length >
        MAX_FILE_SIZE
    ) {
        console.log(
            "Rejected: PDF is larger than 10 MB"
        );

        throw new Error(
            "PDF is larger than 10 MB."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Check PDF signature
    |--------------------------------------------------------------------------
    */

    const pdfHeader =
        pdfBuffer
            .subarray(0, 5)
            .toString("ascii");


    if (
        pdfHeader !== "%PDF-"
    ) {
        console.log(
            "Rejected: Invalid PDF file"
        );

        throw new Error(
            "Invalid PDF file."
        );
    }


    console.log(
        "PDF signature validated"
    );


    /*
    |--------------------------------------------------------------------------
    | Return validated PDF
    |--------------------------------------------------------------------------
    */

    return pdfBuffer;
}