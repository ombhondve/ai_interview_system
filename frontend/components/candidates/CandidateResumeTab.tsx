"use client";

import {
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";

import { Candidate } from "@/types";

import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/Card";

import { Button } from "@/components/ui/Button";

import { Badge } from "@/components/ui/Badge";

import { apiUrl } from "@/lib/client";


// =====================================================
// CANDIDATE RESUME TAB
// =====================================================

export function CandidateResumeTab({
  candidate,
}: {
  candidate: Candidate;
}) {

  // =====================================================
  // RESUME INFORMATION
  // =====================================================

  const resumeFileName =
    candidate.resumeFileName ||
    "Resume.pdf";

  const resumeUrl =
    candidate.resumeUrl || "";


  // =====================================================
  // BUILD RESUME URL
  // =====================================================

  const fullResumeUrl =
    resumeUrl
      ? resumeUrl.startsWith("http://") ||
        resumeUrl.startsWith("https://")
        ? resumeUrl
        : apiUrl(resumeUrl)
      : "";


  // =====================================================
  // PDF PREVIEW URL
  // =====================================================

  const previewUrl =
    fullResumeUrl
      ? `${fullResumeUrl}#zoom=100`
      : "";


  // =====================================================
  // UPLOADED DATE
  // =====================================================

  const uploadedDate =
    candidate.createdAt
      ? new Date(
          candidate.createdAt
        ).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        )
      : "Unknown date";


  // =====================================================
  // OPEN RESUME
  // =====================================================

  const handleOpenResume = () => {

    if (!fullResumeUrl) {
      return;
    }

    window.open(
      fullResumeUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };


  // =====================================================
  // DOWNLOAD RESUME
  // =====================================================

  const handleDownloadResume = () => {

    if (!fullResumeUrl) {
      return;
    }

    const link =
      document.createElement("a");

    link.href = fullResumeUrl;

    link.download = resumeFileName;

    link.target = "_blank";

    link.rel = "noopener noreferrer";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
  };


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <Card>

      {/* =================================================
          HEADER
      ================================================= */}

      <CardHeader
        title="Resume"
        subtitle={`Uploaded ${uploadedDate}`}
        action={
          <div className="flex flex-wrap gap-2">

            {/* OPEN */}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenResume}
              disabled={!fullResumeUrl}
            >
              <ExternalLink className="h-3.5 w-3.5" />

              Open
            </Button>


            {/* DOWNLOAD */}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDownloadResume}
              disabled={!fullResumeUrl}
            >
              <Download className="h-3.5 w-3.5" />

              Download
            </Button>

          </div>
        }
      />


      {/* =================================================
          CONTENT
      ================================================= */}

      <CardContent>

        {/* =================================================
            RESUME FILE INFORMATION
        ================================================= */}

        <div
          className="
            mb-4
            flex
            flex-col
            gap-3
            rounded-lg
            border
            border-slate-100
            bg-slate-50
            px-4
            py-3
            sm:flex-row
            sm:items-center
            sm:justify-between
            dark:border-white/5
            dark:bg-white/5
          "
        >

          {/* FILE INFORMATION */}

          <div className="flex min-w-0 items-center gap-3">

            {/* FILE ICON */}

            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-lg
                bg-danger-50
                text-danger-600
                dark:bg-danger-500/10
              "
            >
              <FileText className="h-4 w-4" />
            </div>


            {/* FILE NAME */}

            <div className="min-w-0">

              <p
                className="
                  truncate
                  text-sm
                  font-medium
                  text-slate-800
                  dark:text-slate-200
                "
                title={resumeFileName}
              >
                {resumeFileName}
              </p>

              <p
                className="
                  text-xs
                  text-slate-500
                  dark:text-slate-400
                "
              >
                PDF Document
              </p>

            </div>

          </div>


          {/* RESUME STATUS */}

          <Badge
            variant={
              fullResumeUrl
                ? "success"
                : "warning"
            }
            className="self-start sm:self-auto"
          >
            {fullResumeUrl
              ? "Available"
              : "Not available"}
          </Badge>

        </div>


        {/* =================================================
            LARGE RESUME PREVIEW
        ================================================= */}

        <div
          className="
            flex
            h-[70vh]
            min-h-[450px]
            w-full
            items-center
            justify-center
            overflow-hidden
            rounded-xl
            border
            border-slate-200
            bg-slate-50
            shadow-sm
            dark:border-white/10
            dark:bg-white/[0.02]
            sm:h-[75vh]
            sm:min-h-[600px]
          "
        >

          {previewUrl ? (

            <iframe
              src={previewUrl}
              title={`${resumeFileName} preview`}
              className="
                h-full
                w-full
                rounded-xl
                border-0
              "
            />

          ) : (

            <div className="px-4 text-center">

              <FileText
                className="
                  mx-auto
                  h-10
                  w-10
                  text-slate-300
                  dark:text-slate-600
                "
              />

              <p
                className="
                  mt-2
                  text-sm
                  text-slate-400
                "
              >
                Resume preview is not available
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  text-slate-400
                "
              >
                The candidate has not uploaded a resume.
              </p>

            </div>

          )}

        </div>

      </CardContent>

    </Card>
  );
}
