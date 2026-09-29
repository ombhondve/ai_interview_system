/**
 * ============================================================
 * RESUME PDF PARSER
 * ============================================================
 *
 * Extraction pipeline:
 *
 * PDF Buffer
 *    |
 *    +--> Native PDF text extraction using pdf-parse
 *    |         |
 *    |         +--> Enough text -> return text
 *    |
 *    +--> OCR fallback using MuPDF + Tesseract
 *              |
 *              +--> Enough text -> return text
 *              |
 *              +--> Not enough -> return ""
 *
 * This file does NOT decide whether the document is a resume.
 * Resume classification is handled by the AI layer.
 */


/**
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const MIN_TEXT_LENGTH = 80;

/**
 * Maximum number of pages that OCR will process.
 *
 * This prevents extremely large/scanned PDFs from consuming
 * excessive CPU and memory.
 */
const MAX_OCR_PAGES = 10;

/**
 * OCR rendering scale.
 *
 * Higher values can improve OCR quality but consume more
 * memory and CPU.
 */
const OCR_SCALE = 2;

/**
 * Maximum accepted PDF size.
 *
 * WhatsApp controller currently uses the same 10 MB limit.
 */
const MAX_PDF_SIZE = 10 * 1024 * 1024;


/**
 * ============================================================
 * TEXT VALIDATION
 * ============================================================
 */

/**
 * Normalize extracted text.
 */
function normalizeText(text) {
    if (typeof text !== "string") {
        return "";
    }

    return text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}


/**
 * Check whether extracted text contains enough usable content.
 */
function isUsableText(text) {
    const normalizedText = normalizeText(text);

    return normalizedText.length >= MIN_TEXT_LENGTH;
}


/**
 * Check whether extracted text contains common resume signals.
 *
 * IMPORTANT:
 * This function is diagnostic only.
 * It does NOT decide whether a document is a resume.
 */
function hasResumeSignals(text) {
    const normalizedText =
        normalizeText(text).toLowerCase();

    if (!normalizedText) {
        return false;
    }

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
 * PDF VALIDATION
 * ============================================================
 */

/**
 * Validate the input PDF buffer.
 */
function validatePDFBuffer(pdfBuffer) {
    if (!Buffer.isBuffer(pdfBuffer)) {
        throw new Error(
            "extractTextFromPDF expected a Buffer."
        );
    }

    if (pdfBuffer.length === 0) {
        throw new Error(
            "PDF buffer is empty."
        );
    }

    if (pdfBuffer.length > MAX_PDF_SIZE) {
        throw new Error(
            "PDF exceeds the 10MB limit."
        );
    }

    const pdfHeader =
        pdfBuffer
            .subarray(0, 5)
            .toString("ascii");

    if (pdfHeader !== "%PDF-") {
        throw new Error(
            "Invalid PDF file."
        );
    }
}


/**
 * ============================================================
 * NATIVE PDF TEXT EXTRACTION
 * ============================================================
 *
 * First attempt:
 *
 * PDF
 *   |
 *   v
 * pdf-parse
 *   |
 *   v
 * Extract text directly
 *
 * This is significantly faster than OCR for normal
 * text-based PDFs.
 */

async function extractNativePDFText(pdfBuffer) {
    let parser = null;

    try {
        const pdfParseModule =
            await import("pdf-parse");

        const PDFParse =
            pdfParseModule.PDFParse;

        if (typeof PDFParse !== "function") {
            throw new Error(
                "PDFParse was not found in pdf-parse."
            );
        }

        parser = new PDFParse({
            data: pdfBuffer
        });

        const pdfData =
            await parser.getText();

        const text =
            pdfData?.text || "";

        return normalizeText(text);

    } finally {

        if (parser) {
            try {
                await parser.destroy();
            } catch (error) {
                console.error(
                    "PDF parser cleanup failed:",
                    error?.message || error
                );
            }
        }
    }
}


/**
 * ============================================================
 * OCR FALLBACK
 * ============================================================
 *
 * Uses:
 *
 * PDF
 *   |
 *   v
 * MuPDF
 *   |
 *   v
 * Render page
 *   |
 *   v
 * PNG
 *   |
 *   v
 * Tesseract
 *   |
 *   v
 * Text
 *
 * We intentionally do not use pdfjs-dist here because the
 * previous implementation had PDF.js API/Worker version
 * mismatch problems.
 */

async function extractTextUsingOCR(pdfBuffer) {
    let worker = null;
    let document = null;

    try {

        console.log(
            "========== OCR FALLBACK START =========="
        );


        /**
         * --------------------------------------------------------
         * Load dependencies
         * --------------------------------------------------------
         */

        const mupdfModule =
            await import("mupdf");

        const mupdf =
            mupdfModule.default ||
            mupdfModule;

        const tesseractModule =
            await import("tesseract.js");

        const createWorker =
            tesseractModule.createWorker;

        if (!mupdf) {
            throw new Error(
                "MuPDF module could not be loaded."
            );
        }

        if (
            typeof createWorker !== "function"
        ) {
            throw new Error(
                "Tesseract createWorker could not be loaded."
            );
        }


        /**
         * --------------------------------------------------------
         * Open PDF
         * --------------------------------------------------------
         */

        document =
            mupdf.PDFDocument.openDocument(
                pdfBuffer,
                "application/pdf"
            );


        if (!document) {
            throw new Error(
                "MuPDF could not open the PDF."
            );
        }


        const totalPages =
            document.countPages();


        console.log(
            "PDF pages:",
            totalPages
        );


        if (
            !Number.isInteger(totalPages) ||
            totalPages <= 0
        ) {
            console.error(
                "PDF contains no pages."
            );

            return "";
        }


        /**
         * --------------------------------------------------------
         * Determine OCR page count
         * --------------------------------------------------------
         */

        const pagesToProcess =
            Math.min(
                totalPages,
                MAX_OCR_PAGES
            );


        console.log(
            "OCR pages to process:",
            pagesToProcess
        );


        /**
         * --------------------------------------------------------
         * Create Tesseract worker
         * --------------------------------------------------------
         */

        console.log(
            "Starting Tesseract worker..."
        );


        worker =
            await createWorker(
                "eng"
            );


        console.log(
            "Tesseract worker started."
        );


        /**
         * --------------------------------------------------------
         * Process pages
         * --------------------------------------------------------
         */

        const pageTexts = [];


        for (
            let pageIndex = 0;
            pageIndex < pagesToProcess;
            pageIndex++
        ) {

            const pageNumber =
                pageIndex + 1;


            console.log(
                `OCR processing page ${pageNumber}/${pagesToProcess}`
            );


            let page = null;
            let pixmap = null;


            try {

                /**
                 * Load page
                 */
                page =
                    document.loadPage(
                        pageIndex
                    );


                if (!page) {
                    console.error(
                        `Could not load page ${pageNumber}`
                    );

                    continue;
                }


                /**
                 * Render page
                 */
                const matrix =
                    mupdf.Matrix.scale(
                        OCR_SCALE,
                        OCR_SCALE
                    );


                pixmap =
                    page.toPixmap(
                        matrix,
                        mupdf.ColorSpace.DeviceRGB,
                        false
                    );


                if (!pixmap) {
                    console.error(
                        `Could not render page ${pageNumber}`
                    );

                    continue;
                }


                /**
                 * Convert rendered page to PNG
                 */
                const imageBuffer =
                    pixmap.asPNG();


                if (
                    !Buffer.isBuffer(imageBuffer) ||
                    imageBuffer.length === 0
                ) {
                    console.error(
                        `Page ${pageNumber} produced an empty image`
                    );

                    continue;
                }


                console.log(
                    `Page ${pageNumber} image size:`,
                    imageBuffer.length,
                    "bytes"
                );


                /**
                 * OCR
                 */
                const result =
                    await worker.recognize(
                        imageBuffer
                    );


                const pageText =
                    normalizeText(
                        result?.data?.text || ""
                    );


                console.log(
                    `Page ${pageNumber} OCR text length:`,
                    pageText.length
                );


                if (pageText) {

                    pageTexts.push(
                        `--- PAGE ${pageNumber} ---\n${pageText}`
                    );
                }

            } catch (pageError) {

                console.error(
                    `OCR failed for page ${pageNumber}:`,
                    pageError?.message ||
                    pageError
                );

            } finally {

                /**
                 * Release page resources.
                 */
                if (page) {
                    try {
                        page.destroy();
                    } catch (error) {
                        console.error(
                            `Page ${pageNumber} cleanup failed:`,
                            error?.message || error
                        );
                    }
                }

                /**
                 * Release pixmap resources if supported.
                 */
                if (
                    pixmap &&
                    typeof pixmap.destroy === "function"
                ) {
                    try {
                        pixmap.destroy();
                    } catch (error) {
                        console.error(
                            `Pixmap ${pageNumber} cleanup failed:`,
                            error?.message || error
                        );
                    }
                }
            }
        }


        /**
         * --------------------------------------------------------
         * Combine OCR results
         * --------------------------------------------------------
         */

        const finalOCRText =
            normalizeText(
                pageTexts.join("\n\n")
            );


        console.log(
            "Total OCR text length:",
            finalOCRText.length
        );


        /**
         * --------------------------------------------------------
         * OCR preview
         * --------------------------------------------------------
         */

        if (finalOCRText) {

            const preview =
                finalOCRText.substring(
                    0,
                    1000
                );


            console.log(
                "OCR TEXT PREVIEW:"
            );

            console.log(
                preview
            );


            if (
                finalOCRText.length > 1000
            ) {
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
            error?.message ||
            error
        );

        return "";

    } finally {

        /**
         * --------------------------------------------------------
         * Cleanup Tesseract
         * --------------------------------------------------------
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
                    error?.message ||
                    error
                );
            }
        }


        /**
         * --------------------------------------------------------
         * Cleanup MuPDF
         * --------------------------------------------------------
         */

        if (document) {

            try {

                document.destroy();

            } catch (error) {

                console.error(
                    "PDF document cleanup failed:",
                    error?.message ||
                    error
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
 *  |
 *  +--> Native extraction
 *  |       |
 *  |       +--> usable -> return
 *  |
 *  +--> OCR fallback
 *          |
 *          +--> usable -> return
 *          |
 *          +--> failed -> return ""
 *
 * This function does NOT determine whether the document is
 * actually a resume.
 */

export async function extractTextFromPDF(
    pdfBuffer
) {

    /**
     * --------------------------------------------------------
     * Validate PDF
     * --------------------------------------------------------
     */

    validatePDFBuffer(
        pdfBuffer
    );


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
            error?.message ||
            error
        );

        nativeText = "";
    }


    /**
     * ========================================================
     * STEP 2: CHECK NATIVE TEXT
     * ========================================================
     */

    if (
        isUsableText(
            nativeText
        )
    ) {

        /**
         * Diagnostic only.
         */
        if (
            hasResumeSignals(
                nativeText
            )
        ) {

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
     * STEP 3: NATIVE EXTRACTION FAILED
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

    if (
        isUsableText(
            ocrText
        )
    ) {

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