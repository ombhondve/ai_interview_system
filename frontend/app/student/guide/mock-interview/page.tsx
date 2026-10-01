"use client";

import {
  StudentGuide,
  GuideSection,
} from "@/components/student/StudentGuide";

const sections: GuideSection[] = [
  {
    number: "01",
    title: "What is a mock interview?",
    description:
      "A mock interview is a practice interview designed to help you become familiar with the interview process before your actual interview.",
    items: [
      "Treat the mock interview like a real interview.",
      "Use it to understand the interview format.",
      "Use the experience to identify areas you can improve.",
    ],
  },

  {
    number: "02",
    title: "Prepare before starting",
    description:
      "Prepare your environment and device before starting the mock interview.",
    items: [
      "Check your microphone.",
      "Check your camera if required.",
      "Check your internet connection.",
      "Keep your resume available.",
      "Choose a quiet environment.",
    ],
  },

  {
    number: "03",
    title: "During the mock interview",
    description:
      "Answer the questions naturally and use the session to practice your communication and technical responses.",
    items: [
      "Listen carefully to each question.",
      "Take a moment to understand the question.",
      "Answer clearly.",
      "Practice explaining your projects.",
      "Use the feedback to improve.",
    ],
  },

  {
    number: "04",
    title: "Mock interview rules",
    description:
      "The mock interview is intended for practice, so use it seriously and honestly.",
    items: [
      "Use your own candidate identity.",
      "Do not share your session access.",
      "Do not intentionally interrupt the session.",
      "Follow the instructions shown by the system.",
    ],
  },

  {
    number: "05",
    title: "After the mock interview",
    description:
      "Review your experience and use any available feedback to prepare for the actual interview.",
    items: [
      "Review your mistakes.",
      "Identify topics you need to revise.",
      "Improve your answers.",
      "Practice again if another mock session is available.",
    ],
  },
];

export default function MockInterviewGuidePage() {
  return (
    <StudentGuide
      title="Mock Interview Guide"
      subtitle="Learn how to use the mock interview to practice before your actual recruitment interview."
      sections={sections}
      continueLabel="Continue to Mock Interview"
      continueHref="/student/mock-interview"
    />
  );
}
