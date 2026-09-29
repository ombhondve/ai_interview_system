/**
 * ============================================================
 * RESUME PDF PARSER
 * ============================================================
 *
 * PDF extraction pipeline:
 *
 * PDF Buffer
 *    |
 *    +--> Native text extraction using MuPDF
 *    |         |
 *    |         +--> Enough text -> return text
 *    |
 *    +--> OCR fallback using MuPDF + Tesseract
 *              |
 *              +--> Enough text -> return text
 *              |
 *              +--> Not enough -> return ""
 *
 * IMPORTANT:
 * - pdf-parse is NOT used.
 * - pdfjs-dist is NOT used.
 * - MuPDF handles native PDF extraction.
 * - MuPDF also renders pages for OCR.
 * - Tesseract handles OCR only when native text is insufficient.
 *
 * This file does NOT decide whether the document is a resume.
 * Resume classification is handled by the AI layer.
 */


/**
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

/**
 * Minimum amount of extracted text considered usable.
 */
const MIN_TEXT_LENGTH = 80;


/**
 * Maximum number of pages to process with OCR.
 *
 * This protects the Vercel function from very large scanned PDFs.
 */
const MAX_OCR_PAGES = 10;


/**
 * OCR rendering scale.
 *
 * 2x provides better OCR quality than 1x while keeping
 * processing reasonably controlled.
 */
const OCR_SCALE = 2;


/**
 * Maximum accepted PDF size.
 *
 * WhatsApp controller currently uses the same 10 MB limit.
 */
const MAX_PDF_SIZE = 10 * 1024 * 1024;


/**
 * Tesseract.js version installed in the project.
 *
 * Your package.json currently uses:
 *
 * "tesseract.js": "^7.0.0"
 *
 * Tesseract.js 7 uses tesseract.js-core 7.x.
 */
const TESSERACT_CORE_VERSION = "7.0.0";


/**
 * Tesseract core files are loaded from jsDelivr.
 *
 * This avoids Vercel failing to package:
 *
 * tesseract-core-relaxedsimd.wasm
 *
 * and the other WASM files.
 *
 * Tesseract documentation expects corePath to point to a
 * directory containing the required core builds.
 */
const TESSERACT_CORE_PATH =
    `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_CORE_VERSION}`;


/**
 * ============================================================
 * TEXT NORMALIZATION
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
    const normalizedText =
        normalizeText(text);

    return (
        normalizedText.length >=
        MIN_TEXT_LENGTH
    );
}


/**
 * ============================================================
 * RESUME SIGNAL DETECTION
 * ============================================================
 *
 * Diagnostic only.
 *
 * This function does NOT classify the document as a resume.
 * AI classification happens later.
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
 * Validate incoming PDF buffer.
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
 * LOAD MUPDF
 * ============================================================
 */

async function loadMuPDF() {
    const mupdfModule =
        await import("mupdf");

    const mupdf =
        mupdfModule.default ||
        mupdfModule;

    if (!mupdf) {
        throw new Error(
            "MuPDF module could not be loaded."
        );
    }

    if (
        !mupdf.PDFDocument ||
        typeof mupdf.PDFDocument.openDocument !== "function"
    ) {
        throw new Error(
            "MuPDF PDFDocument API is unavailable."
        );
    }

    return mupdf;
}


/**
 * ============================================================
 * NATIVE PDF TEXT EXTRACTION
 * ============================================================
 *
 * IMPORTANT:
 *
 * We no longer use:
 *
 * pdf-parse
 * pdfjs-dist
 * PDF.js worker
 *
 * This avoids the Vercel errors:
 *
 * Cannot find module '@napi-rs/canvas'
 *
 * Setting up fake worker failed
 *
 * Cannot find pdf.worker.mjs
 *
 * MuPDF is used directly instead.
 */

async function extractNativePDFText(pdfBuffer) {
    let document = null;

    try {
        console.log(
            "========== MUPDF NATIVE TEXT EXTRACTION START =========="
        );

        const mupdf =
            await loadMuPDF();

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
            "MuPDF native extraction pages:",
            totalPages
        );

        if (
            !Number.isInteger(totalPages) ||
            totalPages <= 0
        ) {
            throw new Error(
                "PDF contains no pages."
            );
        }

        const pageTexts = [];

        for (
            let pageIndex = 0;
            pageIndex < totalPages;
            pageIndex++
        ) {
            let page = null;

            try {
                const pageNumber =
                    pageIndex + 1;

                console.log(
                    `Extracting native text from page ${pageNumber}/${totalPages}`
                );

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
                 * MuPDF structured text extraction.
                 */
                const structuredText =
                    page.toStructuredText();

                if (!structuredText) {
                    console.warn(
                        `No structured text returned for page ${pageNumber}`
                    );

                    continue;
                }

                /**
                 * Convert structured text to normal text.
                 */
                const pageText =
                    typeof structuredText.asText === "function"
                        ? structuredText.asText()
                        : "";

                const normalizedPageText =
                    normalizeText(
                        pageText
                    );

                console.log(
                    `Page ${pageNumber} native text length:`,
                    normalizedPageText.length
                );

                if (normalizedPageText) {
                    pageTexts.push(
                        `--- PAGE ${pageNumber} ---\n${normalizedPageText}`
                    );
                }

            } catch (pageError) {
                console.error(
                    `MuPDF native extraction failed for page ${
                        pageIndex + 1
                    }:`,
                    pageError?.message ||
                    pageError
                );

            } finally {
                if (page) {
                    try {
                        if (
                            typeof page.destroy === "function"
                        ) {
                            page.destroy();
                        }
                    } catch (error) {
                        console.error(
                            `Page ${
                                pageIndex + 1
                            } cleanup failed:`,
                            error?.message ||
                            error
                        );
                    }
                }
            }
        }

        const finalText =
            normalizeText(
                pageTexts.join("\n\n")
            );

        console.log(
            "Total MuPDF native text length:",
            finalText.length
        );

        if (finalText) {
            console.log(
                "Native text preview:"
            );

            console.log(
                finalText.substring(
                    0,
                    1000
                )
            );

            if (finalText.length > 1000) {
                console.log(
                    "... native text preview truncated ..."
                );
            }
        }

        console.log(
            "========== MUPDF NATIVE TEXT EXTRACTION END =========="
        );

        return finalText;

    } finally {
        if (document) {
            try {
                if (
                    typeof document.destroy === "function"
                ) {
                    document.destroy();
                }
            } catch (error) {
                console.error(
                    "MuPDF document cleanup failed:",
                    error?.message ||
                    error
                );
            }
        }
    }
}


/**
 * ============================================================
 * LOAD TESSERACT
 * ============================================================
 */

async function loadTesseract() {
    const tesseractModule =
        await import("tesseract.js");

    const createWorker =
        tesseractModule.createWorker;

    if (
        typeof createWorker !== "function"
    ) {
        throw new Error(
            "Tesseract createWorker could not be loaded."
        );
    }

    return createWorker;
}


/**
 * ============================================================
 * CREATE TESSERACT WORKER
 * ============================================================
 *
 * The important part here is:
 *
 * corePath:
 * https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0
 *
 * This prevents Vercel from looking for the missing local:
 *
 * tesseract-core-relaxedsimd.wasm
 *
 * inside /var/task.
 */

async function createTesseractWorker() {
    const createWorker =
        await loadTesseract();

    console.log(
        "Creating Tesseract worker..."
    );

    const worker =
        await createWorker(
            "eng",
            1,
            {
                corePath:
                    TESSERACT_CORE_PATH,

                /**
                 * Let Tesseract use its default language
                 * download location.
                 */
                logger: (message) => {
                    if (
                        message &&
                        typeof message === "object"
                    ) {
                        if (
                            message.status === "recognizing text"
                        ) {
                            return;
                        }

                        if (
                            message.status === "loading language traineddata"
                        ) {
                            console.log(
                                "Tesseract:",
                                message.status,
                                message.progress
                            );

                            return;
                        }

                        if (
                            message.status === "initializing api"
                        ) {
                            console.log(
                                "Tesseract:",
                                message.status,
                                message.progress
                            );

                            return;
                        }
                    }
                }
            }
        );

    if (!worker) {
        throw new Error(
            "Tesseract worker could not be created."
        );
    }

    console.log(
        "Tesseract worker started successfully."
    );

    return worker;
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
         * Load MuPDF
         * --------------------------------------------------------
         */

        const mupdf =
            await loadMuPDF();

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
                "MuPDF could not open the PDF for OCR."
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

        worker =
            await createTesseractWorker();

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
                 * ------------------------------------------------
                 * Load page
                 * ------------------------------------------------
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
                 * ------------------------------------------------
                 * Render page
                 * ------------------------------------------------
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
                 * ------------------------------------------------
                 * Convert rendered page to PNG
                 * ------------------------------------------------
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
                 * ------------------------------------------------
                 * OCR
                 * ------------------------------------------------
                 */

                const result =
                    await worker.recognize(
                        imageBuffer
                    );

                const pageText =
                    normalizeText(
                        result?.data?.text ||
                        ""
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
                 * ------------------------------------------------
                 * Release page
                 * ------------------------------------------------
                 */

                if (page) {
                    try {
                        if (
                            typeof page.destroy === "function"
                        ) {
                            page.destroy();
                        }
                    } catch (error) {
                        console.error(
                            `Page ${pageNumber} cleanup failed:`,
                            error?.message ||
                            error
                        );
                    }
                }

                /**
                 * ------------------------------------------------
                 * Release pixmap
                 * ------------------------------------------------
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
                            error?.message ||
                            error
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
            console.log(
                "OCR TEXT PREVIEW:"
            );

            console.log(
                finalOCRText.substring(
                    0,
                    1000
                )
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
        /**
         * IMPORTANT:
         *
         * Any Tesseract/MuPDF failure should be converted into
         * a normal empty result instead of crashing the whole
         * webhook process.
         */

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
                if (
                    typeof document.destroy === "function"
                ) {
                    document.destroy();
                }

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
 *  +--> MuPDF native extraction
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
     * STEP 3: NATIVE EXTRACTION FAILED / INSUFFICIENT
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