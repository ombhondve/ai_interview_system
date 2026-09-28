import { PDFParse } from "pdf-parse";
import mupdf from "mupdf";
import { createWorker } from "tesseract.js";

/**
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

/**
 * Minimum amount of extracted text considered usable.
 *
 * This is intentionally kept relatively low because some
 * resumes can be short.
 */
const MIN_TEXT_LENGTH = 80;

/**
 * Maximum number of PDF pages to process with OCR.
 *
 * Increase this if your resumes commonly contain more pages.
 */
const MAX_OCR_PAGES = 10;

/**
 * OCR rendering scale.
 *
 * Higher scale can improve OCR quality but increases memory
 * usage and processing time.
 */
const OCR_SCALE = 2;


/**
 * ============================================================
 * TEXT VALIDATION
 * ============================================================
 */

/**
 * Check whether extracted text contains enough usable content.
 */
function isUsableText(text) {
    if (!text) {
        return false;
    }

    const cleanedText = text
        .replace(/\s+/g, " ")
        .trim();

    return cleanedText.length >= MIN_TEXT_LENGTH;
}


/**
 * Check whether the extracted text contains common resume
 * signals.
 *
 * IMPORTANT:
 * This function does NOT decide whether the document is
 * actually a resume.
 *
 * It is only diagnostic information for the extraction
 * process.
 */
function hasResumeSignals(text) {
    if (!text) {
        return false;
    }

    const normalizedText = text.toLowerCase();

    const signals = [
        "education",
        "experience",
        "skills",
        "technical skills",
        "projects",
        "project",
        "certification",
        "certifications",
        "qualification",
        "qualifications",
        "university",
        "college",
        "degree",
        "internship",
        "professional",
        "employment",
        "career",
        "profile",
        "objective",
        "achievement",
        "achievements",
        "work history",
        "work experience"
    ];

    let matches = 0;

    for (const signal of signals) {
        if (normalizedText.includes(signal)) {
            matches++;
        }
    }

    return matches >= 2;
}


/**
 * ============================================================
 * NATIVE PDF TEXT EXTRACTION
 * ============================================================
 *
 * First attempt:
 *
 * PDF
 *   ↓
 * pdf-parse
 *   ↓
 * Extract text directly
 *
 * This is much faster than OCR for normal text-based PDFs.
 */
async function extractNativePDFText(pdfBuffer) {
    let parser = null;

    try {
        parser = new PDFParse({
            data: pdfBuffer
        });

        const pdfData = await parser.getText();

        return pdfData?.text?.trim() || "";

    } finally {
        if (parser) {
            try {
                await parser.destroy();
            } catch (error) {
                console.error(
                    "PDF parser cleanup failed:",
                    error.message
                );
            }
        }
    }
}


/**
 * ============================================================
 * OCR FALLBACK USING MUPDF + TESSERACT
 * ============================================================
 *
 * Used when native PDF text extraction is insufficient.
 *
 * Flow:
 *
 * PDF
 *   ↓
 * MuPDF
 *   ↓
 * Render PDF page
 *   ↓
 * PNG
 *   ↓
 * Tesseract
 *   ↓
 * Text
 *
 * This avoids directly importing pdfjs-dist and therefore
 * avoids the API/Worker version mismatch we had earlier.
 */
async function extractTextUsingOCR(pdfBuffer) {
    let worker = null;
    let document = null;

    try {
        console.log(
            "========== OCR FALLBACK START =========="
        );

        /**
         * ----------------------------------------------------
         * STEP 1: Open PDF with MuPDF
         * ----------------------------------------------------
         */

        document = mupdf.PDFDocument.openDocument(
            pdfBuffer,
            "application/pdf"
        );

        const totalPages = document.countPages();

        console.log(
            "PDF pages:",
            totalPages
        );

        if (totalPages <= 0) {
            console.error(
                "PDF contains no pages."
            );

            return "";
        }


        /**
         * ----------------------------------------------------
         * STEP 2: Determine number of pages
         * ----------------------------------------------------
         */

        const pagesToProcess = Math.min(
            totalPages,
            MAX_OCR_PAGES
        );

        console.log(
            "OCR pages to process:",
            pagesToProcess
        );


        /**
         * ----------------------------------------------------
         * STEP 3: Create Tesseract worker
         * ----------------------------------------------------
         */

        console.log(
            "Starting Tesseract worker..."
        );

        worker = await createWorker("eng");

        console.log(
            "Tesseract worker started."
        );


        /**
         * ----------------------------------------------------
         * STEP 4: Process pages
         * ----------------------------------------------------
         */

        const pageTexts = [];

        for (
            let pageIndex = 0;
            pageIndex < pagesToProcess;
            pageIndex++
        ) {
            const pageNumber = pageIndex + 1;

            console.log(
                `OCR processing page ${pageNumber}/${pagesToProcess}`
            );


            /**
             * Load PDF page.
             */
            const page =
                document.loadPage(pageIndex);


            /**
             * ------------------------------------------------
             * Render page
             * ------------------------------------------------
             *
             * Scale 2 means the page is rendered at roughly
             * twice the normal resolution.
             */

            const matrix =
                mupdf.Matrix.scale(
                    OCR_SCALE,
                    OCR_SCALE
                );


            /**
             * Render to RGB pixmap.
             */
            const pixmap =
                page.toPixmap(
                    matrix,
                    mupdf.ColorSpace.DeviceRGB,
                    false
                );


            /**
             * Convert rendered page to PNG.
             */
            const imageBuffer =
                pixmap.asPNG();


            console.log(
                `Page ${pageNumber} image size:`,
                imageBuffer.length,
                "bytes"
            );


            /**
             * ------------------------------------------------
             * OCR
             * ------------------------------------------------
             */

            const result =
                await worker.recognize(
                    imageBuffer
                );


            const pageText =
                result?.data?.text?.trim() || "";


            console.log(
                `Page ${pageNumber} OCR text length:`,
                pageText.length
            );


            /**
             * Store text if OCR found something.
             */
            if (pageText) {

                pageTexts.push(
                    `--- PAGE ${pageNumber} ---\n${pageText}`
                );
            }


            /**
             * Release page resources.
             */
            try {
                page.destroy();
            } catch (error) {
                console.error(
                    `Page ${pageNumber} cleanup failed:`,
                    error.message
                );
            }
        }


        /**
         * ----------------------------------------------------
         * STEP 5: Combine OCR results
         * ----------------------------------------------------
         */

        const finalOCRText =
            pageTexts.join("\n\n").trim();


        console.log(
            "Total OCR text length:",
            finalOCRText.length
        );


        /**
         * Display a small preview in logs.
         *
         * This prevents your terminal from being flooded by
         * huge OCR output.
         */
        if (finalOCRText) {

            const preview =
                finalOCRText.substring(0, 1000);

            console.log(
                "OCR TEXT PREVIEW:"
            );

            console.log(preview);

            if (finalOCRText.length > 1000) {
                console.log(
                    "... OCR preview truncated ..."
                );
            }
        }


        console.log(
            "========== OCR FALLBACK END =========="
        );


        return finalOCRText;

    } catch (error) {

        console.error(
            "OCR extraction failed:",
            error.message
        );

        return "";

    } finally {

        /**
         * ----------------------------------------------------
         * Cleanup Tesseract
         * ----------------------------------------------------
         */

        if (worker) {

            try {

                await worker.terminate();

                console.log(
                    "Tesseract worker terminated."
                );

            } catch (error) {

                console.error(
                    "Tesseract worker cleanup failed:",
                    error.message
                );
            }
        }


        /**
         * MuPDF document cleanup.
         */
        if (document) {

            try {

                document.destroy();

            } catch (error) {

                console.error(
                    "PDF document cleanup failed:",
                    error.message
                );
            }
        }
    }
}


/**
 * ============================================================
 * MAIN PDF EXTRACTION FUNCTION
 * ============================================================
 *
 * Complete pipeline:
 *
 * PDF
 *  │
 *  ├── Native text extraction
 *  │       │
 *  │       ├── Enough text → return text
 *  │       │
 *  │       └── Not enough
 *  │
 *  └── OCR fallback
 *          │
 *          ├── OCR successful → return OCR text
 *          │
 *          └── OCR failed → return ""
 *
 * The function does NOT decide whether a document is a
 * resume. That decision belongs to the AI/classification
 * layer.
 */
export async function extractTextFromPDF(pdfBuffer) {

    /**
     * --------------------------------------------------------
     * Validate input
     * --------------------------------------------------------
     */

    if (!Buffer.isBuffer(pdfBuffer)) {

        throw new Error(
            "extractTextFromPDF expected a Buffer"
        );
    }


    if (pdfBuffer.length === 0) {

        throw new Error(
            "PDF buffer is empty"
        );
    }


    console.log(
        "========== PDF EXTRACTION START =========="
    );


    console.log(
        "PDF buffer size:",
        pdfBuffer.length,
        "bytes"
    );


    /**
     * ========================================================
     * STEP 1: NATIVE PDF TEXT EXTRACTION
     * ========================================================
     */

    let nativeText = "";


    try {

        nativeText =
            await extractNativePDFText(
                pdfBuffer
            );


        console.log(
            "Native PDF text length:",
            nativeText.length
        );


    } catch (error) {

        console.error(
            "Native PDF extraction failed:",
            error.message
        );

        nativeText = "";
    }


    /**
     * ========================================================
     * STEP 2: CHECK NATIVE TEXT
     * ========================================================
     */

    if (isUsableText(nativeText)) {

        /**
         * Diagnostic only.
         *
         * We don't reject text simply because it doesn't
         * contain words such as "education" or "skills".
         */
        if (hasResumeSignals(nativeText)) {

            console.log(
                "Resume-related signals detected in native text."
            );

        } else {

            console.log(
                "Native text is usable but resume signals are weak."
            );
        }


        console.log(
            "Using native PDF text."
        );


        console.log(
            "Final extracted text length:",
            nativeText.length
        );


        console.log(
            "========== PDF EXTRACTION END =========="
        );


        return nativeText;
    }


    /**
     * ========================================================
     * STEP 3: NATIVE TEXT FAILED
     * ========================================================
     */

    console.log(
        "Native PDF text extraction returned insufficient text."
    );


    console.log(
        "Starting OCR fallback..."
    );


    /**
     * ========================================================
     * STEP 4: OCR
     * ========================================================
     */

    const ocrText =
        await extractTextUsingOCR(
            pdfBuffer
        );


    /**
     * ========================================================
     * STEP 5: CHECK OCR RESULT
     * ========================================================
     */

    if (isUsableText(ocrText)) {

        console.log(
            "OCR extraction successful."
        );


        console.log(
            "Final extracted text length:",
            ocrText.length
        );


        console.log(
            "========== PDF EXTRACTION END =========="
        );


        return ocrText;
    }


    /**
     * ========================================================
     * STEP 6: BOTH METHODS FAILED
     * ========================================================
     */

    console.error(
        "Both native PDF extraction and OCR failed."
    );


    console.log(
        "========== PDF EXTRACTION END =========="
    );


    return "";
}