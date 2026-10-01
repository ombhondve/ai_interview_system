"use client";

import {
  StudentGuide,
  GuideSection,
} from "@/components/student/StudentGuide";

const sections: GuideSection[] = [
  {
    number: "01",
    title: "After your interview",
    description:
      "After your interview is completed, your application moves to the next stage of the recruitment workflow.",
  },

  {
    number: "02",
    title: "Result processing",
    description:
      "Your result may not be available immediately after the interview because the recruitment workflow may require additional evaluation.",
    items: [
      "Check your student portal for updates.",
      "Keep your registered contact information active.",
      "Read new instructions carefully.",
    ],
  },

  {
    number: "03",
    title: "When your result is available",
    description:
      "Your application result will appear in the result section when it becomes available.",
    items: [
      "Open the Result section.",
      "Read the result carefully.",
      "Check whether any next action is required.",
    ],
  },

  {
    number: "04",
    title: "What happens next",
    description:
      "Depending on the result and recruitment workflow, you may receive additional instructions.",
    items: [
      "Follow any instructions shown in the portal.",
      "Keep checking for important updates.",
      "Keep your registered contact information active.",
    ],
  },
];

export default function ResultGuidePage() {
  return (
    <StudentGuide
      title="Result Guide"
      subtitle="Understand what happens after your interview and how to check your application result."
      sections={sections}
      continueLabel="Continue to Result"
      continueHref="/student/result"
    />
  );
}
