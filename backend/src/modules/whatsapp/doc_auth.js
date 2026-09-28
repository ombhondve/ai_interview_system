export async function documentverification(document){
    if (!document) {
        if (!document) {
            console.log(
                "Document information missing"
            );
    
            return res.sendStatus(200);
        }
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
    
    
        // =====================================================
        // CHECK PDF
        // =====================================================
        if (document.mime_type !=="application/pdf") { 
            console.log(
                "Rejected: File is not PDF"
            );
            return res.sendStatus(200);
        }
        // =====================================================
        // DOWNLOAD PDF FROM JALPI
        // =====================================================
        const pdfBuffer =await downloadWhatsAppMedia(document.id);
        console.log(
            "PDF downloaded successfully"
        );
    
        console.log(
            "PDF size:",
            pdfBuffer.length,
            "bytes"
        );
    
    
                // =====================================================
                // CHECK FILE SIZE
                // =====================================================
    
                const MAX_FILE_SIZE =
                    10 * 1024 * 1024;
    
    
                if (
                    pdfBuffer.length === 0
                ) {
    
                    console.log(
                        "Rejected: Empty PDF"
                    );
    
                    return res.sendStatus(200);
                }
    
    
                if (
                    pdfBuffer.length >
                    MAX_FILE_SIZE
                ) {
    
                    console.log(
                        "Rejected: PDF is larger than 10 MB"
                    );
    
                    return res.sendStatus(200);
                }
    
    
                // =====================================================
                // CHECK PDF SIGNATURE
                // =====================================================
    
                const pdfHeader =
                    pdfBuffer
                        .subarray(0, 5)
                        .toString("ascii");
    
    
                if (pdfHeader !== "%PDF-") {
    
                    console.log(
                        "Rejected: Invalid PDF file"
                    );
    
                    return res.sendStatus(200);
                }
    
    
                console.log(
                    "PDF signature validated"
                );
    return pdfBuffer
            }}