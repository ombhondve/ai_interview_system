import { Slot } from "@/types";

function iso(daysFromToday: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().split("T")[0];
}

export const mockSlots: Slot[] = [
  { id: "s1", date: iso(1), startTime: "10:00 AM", endTime: "10:45 AM", timezone: "IST", capacity: 1, status: "booked", bookedBy: "Priya Patil", role: "Frontend Developer" },
  { id: "s2", date: iso(1), startTime: "11:00 AM", endTime: "11:45 AM", timezone: "IST", capacity: 1, status: "available", role: "Full Stack Developer" },
  { id: "s3", date: iso(1), startTime: "2:00 PM", endTime: "2:45 PM", timezone: "IST", capacity: 1, status: "available", role: "Backend Developer" },
  { id: "s4", date: iso(2), startTime: "9:30 AM", endTime: "10:15 AM", timezone: "IST", capacity: 1, status: "cancelled", role: "AI/ML Intern" },
  { id: "s5", date: iso(2), startTime: "10:30 AM", endTime: "11:15 AM", timezone: "IST", capacity: 1, status: "available", role: "Full Stack Developer" },
  { id: "s6", date: iso(3), startTime: "10:00 AM", endTime: "10:45 AM", timezone: "IST", capacity: 1, status: "booked", bookedBy: "Karan Mehta", role: "Full Stack Developer" },
  { id: "s7", date: iso(3), startTime: "3:30 PM", endTime: "4:15 PM", timezone: "IST", capacity: 1, status: "available", role: "Backend Developer" },
  { id: "s8", date: iso(5), startTime: "11:00 AM", endTime: "11:45 AM", timezone: "IST", capacity: 1, status: "available", role: "Frontend Developer" },
  { id: "s9", date: iso(5), startTime: "4:00 PM", endTime: "4:45 PM", timezone: "IST", capacity: 1, status: "available", role: "AI/ML Intern" },
  { id: "s10", date: iso(7), startTime: "10:00 AM", endTime: "10:45 AM", timezone: "IST", capacity: 1, status: "available", role: "Full Stack Developer" },
  { id: "s11", date: iso(-2), startTime: "2:00 PM", endTime: "2:45 PM", timezone: "IST", capacity: 1, status: "booked", bookedBy: "Amit Joshi", role: "Backend Developer" },
  { id: "s12", date: iso(-5), startTime: "3:30 PM", endTime: "4:15 PM", timezone: "IST", capacity: 1, status: "booked", bookedBy: "Ananya Rao", role: "AI/ML Intern" },
  { id: "s13", date: iso(0), startTime: "9:00 AM", endTime: "9:45 AM", timezone: "IST", capacity: 1, status: "available", role: "Full Stack Developer" },
  { id: "s14", date: iso(0), startTime: "1:00 PM", endTime: "1:45 PM", timezone: "IST", capacity: 1, status: "cancelled", role: "Backend Developer" },
  { id: "s15", date: iso(4), startTime: "12:00 PM", endTime: "12:45 PM", timezone: "IST", capacity: 1, status: "booked", bookedBy: "Tanvi Kulkarni", role: "AI/ML Intern" },
];