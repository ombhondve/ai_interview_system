import { Candidate } from "@/types";

import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/Card";

import { Badge } from "@/components/ui/Badge";


// =====================================================
// FORMAT SKILL
// =====================================================

function formatSkill(skill: unknown): string {
  if (
    skill === null ||
    skill === undefined ||
    skill === ""
  ) {
    return "Unknown skill";
  }

  if (
    typeof skill === "string" ||
    typeof skill === "number" ||
    typeof skill === "boolean"
  ) {
    return String(skill);
  }

  if (Array.isArray(skill)) {
    return skill
      .map((item) => formatSkill(item))
      .join(", ");
  }

  if (typeof skill === "object") {
    return Object.entries(
      skill as Record<string, unknown>
    )
      .map(([key, value]) => {
        const formattedKey = key
          .replace(/([A-Z])/g, " $1")
          .replace(/[_-]/g, " ")
          .replace(/^./, (char) =>
            char.toUpperCase()
          );

        return `${formattedKey}: ${formatSkill(value)}`;
      })
      .join(" • ");
  }

  return String(skill);
}


// =====================================================
// CANDIDATE SKILLS TAB
// =====================================================

export function CandidateSkillsTab({
  candidate,
}: {
  candidate: Candidate;
}) {

  const skills = candidate.skills ?? [];


  return (
    <Card>

      {/* =================================================
          HEADER
      ================================================= */}

      <CardHeader
        title="Skills"
        subtitle={`${skills.length} skills extracted from resume`}
      />


      {/* =================================================
          SKILLS
      ================================================= */}

      <CardContent className="flex flex-wrap gap-2">

        {skills.length > 0 ? (

          skills.map((skill, index) => (

            <Badge
              key={`skill-${index}`}
              variant="accent"
              className="px-3 py-1.5 text-sm"
            >
              {formatSkill(skill)}
            </Badge>

          ))

        ) : (

          <p className="text-sm text-slate-500 dark:text-slate-400">
            No skills available
          </p>

        )}

      </CardContent>

    </Card>
  );
}
