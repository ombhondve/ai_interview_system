"use client";

import {
  StudentGuide,
  GuideSection,
} from "@/components/student/StudentGuide";

const sections: GuideSection[] = [
  {
    number: "01",
    title: "Why your project matters",
    description:
      "Your project can help demonstrate your practical knowledge, problem-solving approach, technical skills, and ability to explain your work.",
  },

  {
    number: "02",
    title: "Prepare your project",
    description:
      "Before discussing your project, make sure you understand the project from beginning to end.",
    items: [
      "Know the problem your project solves.",
      "Understand your project's architecture.",
      "Know the technologies you used.",
      "Understand your database and APIs if applicable.",
      "Know what you personally worked on.",
    ],
  },

  {
    number: "03",
    title: "How to explain your project",
    description:
      "Explain your project in a simple and structured way so that the interviewer can understand your contribution.",
    items: [
      "Start with the problem.",
      "Explain your solution.",
      "Explain the main technologies.",
      "Explain your personal contribution.",
      "Explain important challenges you solved.",
    ],
  },

  {
    number: "04",
    title: "Project discussion rules",
    description:
      "Be honest and clear when discussing your project and your contribution.",
    items: [
      "Explain only work you understand.",
      "Be clear about your personal contribution.",
      "Do not claim work you did not perform.",
      "Be prepared to explain technical decisions.",
    ],
  },

  {
    number: "05",
    title: "Before the interview",
    description:
      "Review your project once more and prepare to answer follow-up questions about your implementation.",
    items: [
      "Review your source code if available.",
      "Review your project architecture.",
      "Review important technical decisions.",
      "Prepare to explain challenges and solutions.",
    ],
  },
];

export default function ProjectGuidePage() {
  return (
    <StudentGuide
      title="Project Guide"
      subtitle="Learn how to prepare and explain your project during the recruitment process."
      sections={sections}
      continueLabel="Continue to Project"
      continueHref="/student/project"
    />
  );
}
