"use client";

import { GraduationCap } from "lucide-react";

import { Candidate, getEducationList } from "@/types";

import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/Card";


// =====================================================
// HELPER
// Convert any education item into displayable text
// =====================================================

function formatEducationItem(item: unknown): {
  title: string;
  details: string[];
} {
  // -----------------------------------------------------
  // String
  // -----------------------------------------------------

  if (typeof item === "string") {
    return {
      title: item,
      details: [],
    };
  }


  // -----------------------------------------------------
  // Null / undefined
  // -----------------------------------------------------

  if (item === null || item === undefined) {
    return {
      title: "Education",
      details: [],
    };
  }


  // -----------------------------------------------------
  // Object
  // -----------------------------------------------------

  if (typeof item === "object") {
    const data =
      item as Record<string, unknown>;

    const preferredTitle =
      data.degree ??
      data.qualification ??
      data.program ??
      data.course ??
      data.title ??
      data.name;

    const details: string[] = [];

    const institution =
      data.institution ??
      data.university ??
      data.college ??
      data.school;

    const year =
      data.year ??
      data.graduationYear ??
      data.graduation_year;

    const percentage =
      data.percentage ??
      data.percent;

    const cgpa =
      data.cgpa ??
      data.gpa;

    if (institution !== undefined && institution !== null) {
      details.push(
        `Institution: ${String(institution)}`
      );
    }

    if (year !== undefined && year !== null) {
      details.push(
        `Year: ${String(year)}`
      );
    }

    if (
      percentage !== undefined &&
      percentage !== null
    ) {
      details.push(
        `Percentage: ${String(percentage)}`
      );
    }

    if (
      cgpa !== undefined &&
      cgpa !== null
    ) {
      details.push(
        `CGPA: ${String(cgpa)}`
      );
    }


    // ---------------------------------------------------
    // If there is no known title, find other useful data
    // ---------------------------------------------------

    if (
      preferredTitle !== undefined &&
      preferredTitle !== null
    ) {
      return {
        title: String(preferredTitle),
        details,
      };
    }


    // ---------------------------------------------------
    // Fallback for completely different structures
    // ---------------------------------------------------

    const fallbackDetails = Object.entries(data)
      .filter(
        ([, value]) =>
          value !== null &&
          value !== undefined &&
          value !== ""
      )
      .map(
        ([key, value]) =>
          `${formatLabel(key)}: ${formatValue(value)}`
      );

    return {
      title: "Education",
      details:
        fallbackDetails.length > 0
          ? fallbackDetails
          : details,
    };
  }


  // -----------------------------------------------------
  // Number / Boolean / Other primitive
  // -----------------------------------------------------

  return {
    title: String(item),
    details: [],
  };
}


// =====================================================
// FORMAT OBJECT KEY
// =====================================================

function formatLabel(key: string): string {
  return key
    .replace(/[_-]/g, " ")
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase()
    );
}


// =====================================================
// FORMAT OBJECT VALUE
// =====================================================

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => formatValue(item))
      .join(", ");
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    return Object.entries(
      value as Record<string, unknown>
    )
      .map(
        ([key, item]) =>
          `${formatLabel(key)}: ${formatValue(item)}`
      )
      .join(", ");
  }

  return String(value);
}


// =====================================================
// EDUCATION TAB
// =====================================================

export function CandidateEducationTab({
  candidate,
}: {
  candidate: Candidate;
}) {

  const education =
    getEducationList(candidate.education);


  return (
    <Card>

      <CardHeader title="Education" />

      <CardContent>

        {education.length > 0 ? (

          <div className="space-y-4">

            {education.map(
              (educationItem, index) => {

                const formatted =
                  formatEducationItem(
                    educationItem
                  );

                return (
                  <div
                    key={`education-${index}`}
                    className="
                      flex
                      items-start
                      gap-4
                      rounded-lg
                      border
                      border-slate-100
                      p-4
                      dark:border-white/5
                    "
                  >

                    {/* =====================================
                        ICON
                    ===================================== */}

                    <div
                      className="
                        flex
                        h-10
                        w-10
                        shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        bg-accent-50
                        text-accent-600
                        dark:bg-accent-500/10
                      "
                    >

                      <GraduationCap
                        className="h-5 w-5"
                      />

                    </div>


                    {/* =====================================
                        EDUCATION INFORMATION
                    ===================================== */}

                    <div className="min-w-0">

                      <p
                        className="
                          text-sm
                          font-semibold
                          text-slate-900
                          dark:text-white
                        "
                      >
                        {formatted.title}
                      </p>


                      {formatted.details.length >
                        0 && (

                        <div
                          className="
                            mt-2
                            space-y-1
                          "
                        >

                          {formatted.details.map(
                            (detail, detailIndex) => (

                              <p
                                key={
                                  `education-${index}-detail-${detailIndex}`
                                }
                                className="
                                  text-sm
                                  leading-6
                                  text-slate-600
                                  dark:text-slate-300
                                "
                              >
                                {detail}
                              </p>

                            )
                          )}

                        </div>

                      )}

                    </div>

                  </div>
                );
              }
            )}

          </div>

        ) : (

          <div
            className="
              flex
              items-center
              justify-center
              rounded-lg
              border
              border-dashed
              border-slate-200
              p-8
              dark:border-white/10
            "
          >

            <p
              className="
                text-sm
                text-slate-500
                dark:text-slate-400
              "
            >
              No education information available
            </p>

          </div>

        )}

      </CardContent>

    </Card>
  );
}
