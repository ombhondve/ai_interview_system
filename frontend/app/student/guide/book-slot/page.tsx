"use client";

import {
  StudentGuide,
  GuideSection,
} from "@/components/student/StudentGuide";

const sections: GuideSection[] = [
  {
    number: "01",
    title: "Understand interview slots",
    description:
      "Interview slots are the available dates and times when you can attend your interview. Choose a slot that you can attend without conflicts.",
    items: [
      "Review the available dates.",
      "Review the available interview times.",
      "Choose a time when you will definitely be available.",
    ],
  },

  {
    number: "02",
    title: "How to book a slot",
    description:
      "Select an available date and time and then confirm your selection.",
    items: [
      "Select an available date.",
      "Select an available time.",
      "Review your selected date and time.",
      "Confirm your booking.",
    ],
  },

  {
    number: "03",
    title: "Booking rules",
    description:
      "Choose your interview slot carefully because the selected slot determines when your interview will take place.",
    items: [
      "Do not select a slot you cannot attend.",
      "Check the date before confirming.",
      "Check the time before confirming.",
      "Do not intentionally create duplicate bookings.",
    ],
  },

  {
    number: "04",
    title: "After booking",
    description:
      "After your slot is successfully booked, your scheduled interview information will be shown in the student portal according to the recruitment workflow.",
    items: [
      "Check your scheduled interview date.",
      "Check your scheduled interview time.",
      "Save the interview information.",
      "Prepare before your scheduled interview.",
    ],
  },
];

export default function BookSlotGuidePage() {
  return (
    <StudentGuide
      title="Book Slot Guide"
      subtitle="Learn how interview slot booking works and what you should check before confirming your interview."
      sections={sections}
      continueLabel="Continue to Book Slot"
      continueHref="/student/book-slot"
    />
  );
}
