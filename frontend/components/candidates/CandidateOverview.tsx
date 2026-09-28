import { Candidate, getEducationList } from "@/types";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/Card";
import { CircularProgress } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";

export function CandidateOverview({
  candidate,
}: {
  candidate: Candidate;
}) {
  const educationList = getEducationList(candidate.education);

  return (
    <div className="grid gap-5 lg:grid-cols-3">

      {/* =====================================================
          PERSONAL DETAILS
      ===================================================== */}

      <Card className="lg:col-span-2">
        <CardHeader title="Personal Details" />

        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <Field
            label="Full Name"
            value={candidate.name}
          />

          <Field
            label="Email"
            value={candidate.email}
          />

          <Field
            label="Phone"
            value={candidate.phone}
          />

          <Field
            label="Location"
            value={candidate.location}
          />

          <Field
            label="Role Applied For"
            value={candidate.role}
          />

          <Field
            label="Batch"
            value={candidate.batch}
          />

        </CardContent>
      </Card>


      {/* =====================================================
          JD MATCH SCORE
      ===================================================== */}

      <Card>
        <CardHeader title="JD Match Score" />

        <CardContent className="flex flex-col items-center py-6">

          <CircularProgress
            value={candidate.jdMatchScore ?? 0}
            label="Match"
            size={110}
          />

          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Based on resume skills and education against the{" "}
            {candidate.role || "applied role"} requirements.
          </p>

        </CardContent>
      </Card>


      {/* =====================================================
          EDUCATION
      ===================================================== */}

      <Card className="lg:col-span-2">
        <CardHeader title="Education Summary" />

        <CardContent className="space-y-4">

          {candidate.education &&
          educationList.length > 0 ? (

            educationList.map(
              (education, index) => (
                <Field
                  key={`education-${index}`}
                  label={`Education ${index + 1}`}
                  value={formatValue(education)}
                />
              )
            )

          ) : (

            <Field
              label="Education"
              value="Not available"
            />

          )}

        </CardContent>
      </Card>


      {/* =====================================================
          TOP SKILLS
      ===================================================== */}

      <Card>
        <CardHeader title="Top Skills" />

        <CardContent className="flex flex-wrap gap-2">

          {candidate.skills &&
          candidate.skills.length > 0 ? (

            candidate.skills
              .slice(0, 6)
              .map((skill, index) => (
                <Badge
                  key={`skill-${index}`}
                  variant="accent"
                >
                  {formatValue(skill)}
                </Badge>
              ))

          ) : (

            <p className="text-sm text-slate-500 dark:text-slate-400">
              No skills available
            </p>

          )}

        </CardContent>
      </Card>

    </div>
  );
}


// =====================================================
// FORMAT DYNAMIC VALUES
// =====================================================

function formatValue(value: unknown): string {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not available";
  }


  // Simple values

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }


  // Arrays

  if (Array.isArray(value)) {
    return value
      .map((item) => formatValue(item))
      .join(", ");
  }


  // Objects

  if (typeof value === "object") {

    const entries = Object.entries(
      value as Record<string, unknown>
    );

    if (entries.length === 0) {
      return "Not available";
    }

    return entries
      .map(([key, item]) => {
        const formattedKey = key
          .replace(/([A-Z])/g, " $1")
          .replace(/[_-]/g, " ")
          .replace(/^./, (char) => char.toUpperCase());

        return `${formattedKey}: ${formatValue(item)}`;
      })
      .join(" • ");
  }


  return String(value);
}


// =====================================================
// FIELD COMPONENT
// =====================================================

function Field({
  label,
  value,
}: {
  label: string;
  value?: unknown;
}) {
  return (
    <div>

      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
        {formatValue(value)}
      </p>

    </div>
  );
}