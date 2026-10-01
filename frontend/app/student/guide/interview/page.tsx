"use client";

import {
  StudentGuide,
  GuideSection,
} from "@/components/student/StudentGuide";

const sections: GuideSection[] = [
  {
    number: "01",
    title: "Understand your interview",
    description:
      "Your interview is an important stage of the recruitment process. Check your scheduled date and time before joining.",
    items: [
      "Check your interview date.",
      "Check your interview time.",
      "Read the interview instructions.",
      "Keep your resume available.",
    ],
  },

  {
    number: "02",
    title: "Prepare your device",
    description:
      "Make sure the device you will use for the interview is ready.",
    items: [
      "Check your internet connection.",
      "Check your microphone.",
      "Check your camera if required.",
      "Charge your laptop or phone.",
      "Close unnecessary applications.",
    ],
  },

  {
    number: "03",
    title: "Prepare your environment",
    description:
      "Choose an environment where you can attend the interview without unnecessary interruptions.",
    items: [
      "Choose a quiet place.",
      "Make sure you have enough lighting if video is required.",
      "Keep your required documents nearby.",
      "Avoid unnecessary interruptions.",
    ],
  },

  {
    number: "04",
    title: "Interview rules",
    description:
      "Follow the instructions provided by the recruitment system and interviewer.",
    items: [
      "Join on time.",
      "Use your own candidate identity.",
      "Do not share your interview link.",
      "Follow the interviewer's instructions.",
      "Do not intentionally disconnect from the interview.",
    ],
  },

  {
    number: "05",
    title: "During the interview",
    description:
      "Listen carefully and answer questions clearly. If you do not understand something, ask for clarification.",
    items: [
      "Listen carefully.",
      "Speak clearly.",
      "Answer the question being asked.",
      "Ask for clarification when necessary.",
      "Remain professional throughout the interview.",
    ],
  },
];

export default function InterviewGuidePage() {
  return (
    <StudentGuide
      title="Interview Guide"
      subtitle="Prepare yourself, your device, and your environment before attending your interview."
      sections={sections}
      continueLabel="Continue to Interview"
      continueHref="/student/interview"
    />
  );
}
