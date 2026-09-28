export type CandidateStatus =
  | "received"
  | "under_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "completed"
  | "decided";

export type InterviewStatus =
  | "not_scheduled"
  | "scheduled"
  | "completed"
  | "no_show"
  | "failed";

/* =========================================================
   ACTIVITY
========================================================= */

export interface ActivityEvent {
  id: string;
  label: string;
  description: string;
  timestamp: string;
  state: "complete" | "current" | "upcoming";
}

/* =========================================================
   CANDIDATE
========================================================= */

export interface Candidate {
  id: string;

  name: string;

  email: string;

  phone: string;

  location: string;

  role: string;

  status: CandidateStatus;

  jdMatchScore: number;

  batch: string;

  receivedDate: string;

  avatarUrl?: string;

  skills: string[];

  education: {
    degree: string;
    college: string;
    year: string;
  };

  interviewStatus: InterviewStatus;

  resume: {
    fileName: string;
    uploadDate: string;
    ocrConfidence: number;
  };

  interview?: {
    date: string;
    time: string;
    status: InterviewStatus;
  };

  /*
   * Project assigned to this candidate.
   *
   * The project ID is important because it allows us
   * to determine exactly which project is assigned.
   */
  assignedProject?: {
    id: string;
    title: string;
    difficulty: "junior" | "mid" | "senior";
  };

  activity: ActivityEvent[];

  rejectionReason?: string;

  finalDecision?: "selected" | "rejected" | "pending";
}

/* =========================================================
   INTERVIEW QUESTIONS / ANSWERS
========================================================= */

export interface QAItem {
  id: string;

  question: string;

  category:
    | "resume"
    | "technical"
    | "behavioral"
    | "project";

  response: string;

  score: number;
}

/* =========================================================
   INTERVIEW INTEGRITY
========================================================= */

export interface IntegrityFlags {
  faceMatchScore: number;

  identityMismatch: boolean;

  multiFaceDetected: boolean;

  tabSwitchCount: number;

  silenceFlag: boolean;
}

/* =========================================================
   PROJECT WALKTHROUGH
========================================================= */

export interface ProjectWalkthrough {
  projectTitle: string;

  summary: string;

  codeQualityScore: number;

  explanationClarityScore: number;

  ownershipScore: number;
}

/* =========================================================
   AI ANALYSIS
========================================================= */

export interface AIAnalysis {
  summary: string;

  strengths: string[];

  improvements: string[];

  recommendation:
    | "select"
    | "reject"
    | "borderline";
}

/* =========================================================
   INTERVIEW SCORES
========================================================= */

export interface InterviewScores {
  communication: number;

  technical: number;

  problemSolving: number;

  project: number;
}

/* =========================================================
   INTERVIEW
========================================================= */

export interface Interview {
  id: string;

  candidateId: string;

  candidateName: string;

  candidateEmail: string;

  role: string;

  date: string;

  time: string;

  durationMinutes: number;

  status:
    | "scheduled"
    | "completed"
    | "no_show"
    | "failed";

  project: string;

  meetLink: string;

  recordingAvailable: boolean;

  qa: QAItem[];

  projectWalkthrough?: ProjectWalkthrough;

  integrityFlags?: IntegrityFlags;

  aiAnalysis?: AIAnalysis;

  scores?: InterviewScores;

  overallScore?: number;

  reportStatus?: "pending" | "decided";
}

/* =========================================================
   INTERVIEW SLOT
========================================================= */

export interface Slot {
  id: string;

  date: string;

  startTime: string;

  endTime: string;

  timezone: string;

  capacity: number;

  status:
    | "available"
    | "booked"
    | "cancelled";

  bookedBy?: string;

  role?: string;
}

/* =========================================================
   PROJECT
========================================================= */

export interface ProjectBrief {
  id: string;

  title: string;

  role: string;

  difficulty:
    | "junior"
    | "mid"
    | "senior";

  description: string;

  technologies: string[];

  briefUrl?: string;

  /*
   * Number of candidates currently assigned
   * to this project.
   */
  assignedCount: number;

  status:
    | "active"
    | "archived";
}

/* =========================================================
   PERFORMANCE REPORT
========================================================= */

export interface PerformanceReport {
  id: string;

  candidateId: string;

  candidateName: string;

  interviewDate: string;

  scores: InterviewScores;

  overallScore: number;

  aiSummary: string;

  strengths: string[];

  improvements: string[];

  aiRecommendation:
    | "select"
    | "reject"
    | "borderline";

  status:
    | "pending"
    | "decided";

  finalDecision?:
    | "selected"
    | "rejected"
    | "pending";
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

export type NotificationChannel =
  | "whatsapp"
  | "email"
  | "sms"
  | "system";

export type NotificationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed";

export interface NotificationItem {
  id: string;

  recipient: string;

  candidateName: string;

  message: string;

  channel: NotificationChannel;

  status: NotificationStatus;

  timestamp: string;
}

/* =========================================================
   TOAST
========================================================= */

export interface ToastMessage {
  id: string;

  type:
    | "success"
    | "error"
    | "warning"
    | "info";

  title: string;

  description?: string;
}