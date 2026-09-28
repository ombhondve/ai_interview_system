import { mockCandidates } from "@/data/mock/candidates";
import { mockInterviews } from "@/data/mock/interviews";
import { mockSlots } from "@/data/mock/slots";

import type {
  Candidate,
  Interview,
  Slot,
  ProjectBrief,
  NotificationItem,
  PerformanceReport,
} from "@/types";


// =====================================================
// TYPES
// =====================================================

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "recruiter";
  active: boolean;
};


export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  category: string;
  severity: "info" | "warning" | "critical";
  timestamp: string;
  details?: string;
};


export type StudentSession = {
  token: string;
  candidateId: string;
  expiresAt: number;
};


// =====================================================
// PROJECT TYPE
// =====================================================

export type ProjectDifficulty =
  | "junior"
  | "mid"
  | "senior";


export type ProjectStatus =
  | "active"
  | "archived";


export type StoredProject = ProjectBrief & {
  assignedCount: number;
  status: ProjectStatus;
};


// =====================================================
// DEFAULT PROJECTS
// =====================================================

const initialProjects: StoredProject[] = [
  {
    id: "p1",

    title:
      "E-commerce Product Catalog UI",

    role:
      "Frontend Developer",

    difficulty:
      "mid",

    description:
      "Build a responsive product catalog with search, filters and cart-ready architecture.",

    technologies: [
      "React",
      "TypeScript",
      "Tailwind CSS",
    ],

    assignedCount: 1,

    status:
      "active",
  },

  {
    id: "p2",

    title:
      "Inventory Management API",

    role:
      "Backend Developer",

    difficulty:
      "mid",

    description:
      "Design a transactional inventory REST API with validation and concurrency handling.",

    technologies: [
      "Node.js",
      "PostgreSQL",
      "Redis",
    ],

    assignedCount: 1,

    status:
      "active",
  },

  {
    id: "p3",

    title:
      "Sentiment Analysis Microservice",

    role:
      "AI/ML Intern",

    difficulty:
      "junior",

    description:
      "Expose an NLP sentiment model through a small, documented API.",

    technologies: [
      "Python",
      "Flask",
      "scikit-learn",
    ],

    assignedCount: 1,

    status:
      "active",
  },
];


// =====================================================
// ADMINS
// =====================================================

const admins: AdminUser[] = [
  {
    id: "adm-1",
    name: "Admin User",
    email: "admin@example.com",
    role: "superadmin",
    active: true,
  },

  {
    id: "adm-2",
    name: "Recruiter User",
    email: "recruiter@example.com",
    role: "recruiter",
    active: true,
  },
];


// =====================================================
// IN-MEMORY STATE
// =====================================================

let candidates: Candidate[] = [
  ...mockCandidates,
];

let interviews: Interview[] = [
  ...mockInterviews,
];

let slots: Slot[] = [
  ...mockSlots,
];


/*
 * IMPORTANT
 *
 * This must NOT be const.
 *
 * Project API routes need to:
 *
 * - create projects
 * - update projects
 * - delete projects
 * - assign candidates
 * - update assignedCount
 */
export let projects: StoredProject[] =
  structuredClone(initialProjects);


let notifications: NotificationItem[] =
  [];

let auditLogs: AuditEntry[] =
  [];


// =====================================================
// AUTH SESSIONS
// =====================================================

const sessions =
  new Map<
    string,
    {
      adminId: string;
      expiresAt: number;
    }
  >();


// =====================================================
// STUDENT SESSIONS
// =====================================================

const studentSessions =
  new Map<
    string,
    StudentSession
  >();


// =====================================================
// OTP STORE
// =====================================================

const otpStore =
  new Map<
    string,
    {
      otp: string;
      expiresAt: number;
      attempts: number;
      candidateId: string;
    }
  >();


// =====================================================
// INVITE TOKENS
// =====================================================

const inviteTokens =
  new Map<
    string,
    {
      candidateId: string;
      expiresAt: number;
    }
  >();


// =====================================================
// OTP THROTTLE
// =====================================================

const otpSendThrottle =
  new Map<
    string,
    number[]
  >();


// =====================================================
// CLONE HELPER
// =====================================================

function clone<T>(
  value: T
): T {

  return structuredClone(
    value
  );

}


// =====================================================
// STATE
// =====================================================

export function getState() {

  return {
    candidates,
    interviews,
    slots,
    projects,
    admins,
    notifications,
    auditLogs,
  };

}


// =====================================================
// RESET STATE
// =====================================================

export function resetState() {

  candidates =
    clone(mockCandidates);

  interviews =
    clone(mockInterviews);

  slots =
    clone(mockSlots);

  projects =
    clone(initialProjects);

  notifications =
    [];

  auditLogs =
    [];

}


// =====================================================
// AUDIT
// =====================================================

export function addAudit(
  actor: string,
  action: string,
  target: string,
  category = "system",
  severity: AuditEntry["severity"] = "info",
  details?: string
) {

  auditLogs.unshift({

    id:
      crypto.randomUUID(),

    actor,

    action,

    target,

    category,

    severity,

    timestamp:
      new Date().toISOString(),

    details,

  });

}


// =====================================================
// ADMIN
// =====================================================

export function getAdminById(
  id: string
) {

  return (
    admins.find(
      (admin) =>
        admin.id === id
    ) ?? null
  );

}


// =====================================================
// ADMIN SESSION
// =====================================================

export function createAdminSession(
  adminId: string
) {

  const token =
    crypto.randomUUID();


  sessions.set(
    token,
    {
      adminId,

      expiresAt:
        Date.now() +
        8 *
          60 *
          60 *
          1000,
    }
  );


  return token;

}


// =====================================================
// GET ADMIN SESSION
// =====================================================

export function getAdminSession(
  token?: string
) {

  if (!token) {
    return null;
  }


  const session =
    sessions.get(
      token
    );


  if (
    !session ||
    session.expiresAt <
      Date.now()
  ) {

    sessions.delete(
      token
    );

    return null;

  }


  const admin =
    getAdminById(
      session.adminId
    );


  return admin?.active
    ? admin
    : null;

}


// =====================================================
// DELETE ADMIN SESSION
// =====================================================

export function deleteAdminSession(
  token?: string
) {

  if (token) {

    sessions.delete(
      token
    );

  }

}


// =====================================================
// STUDENT TOKEN
// =====================================================

export function createStudentToken(
  candidateId: string
) {

  /*
   * Only one active student session
   * per candidate.
   */

  for (
    const [
      key,
      session,
    ] of studentSessions
  ) {

    if (
      session.candidateId ===
      candidateId
    ) {

      studentSessions.delete(
        key
      );

    }

  }


  const token =
    crypto.randomUUID();


  studentSessions.set(
    token,
    {

      token,

      candidateId,

      expiresAt:
        Date.now() +
        7 *
          24 *
          60 *
          60 *
          1000,

    }
  );


  return token;

}


// =====================================================
// REVOKE STUDENT TOKENS
// =====================================================

export function revokeStudentTokens(
  candidateId: string
) {

  for (
    const [
      key,
      session,
    ] of studentSessions
  ) {

    if (
      session.candidateId ===
      candidateId
    ) {

      studentSessions.delete(
        key
      );

    }

  }

}


// =====================================================
// GET STUDENT CANDIDATE
// =====================================================

export function getStudentCandidate(
  token?: string
) {

  if (!token) {
    return null;
  }


  const session =
    studentSessions.get(
      token
    );


  if (
    !session ||
    session.expiresAt <
      Date.now()
  ) {

    studentSessions.delete(
      token
    );

    return null;

  }


  return (
    candidates.find(
      (candidate) =>
        candidate.id ===
        session.candidateId
    ) ?? null
  );

}


// =====================================================
// OTP THROTTLE
// =====================================================

export function canSendOtp(
  identifier: string
) {

  const now =
    Date.now();

  const windowMs =
    10 * 60 * 1000;

  const max =
    3;


  const hits =
    (
      otpSendThrottle.get(
        identifier
      ) || []
    ).filter(
      (timestamp) =>
        now - timestamp <
        windowMs
    );


  if (
    hits.length >= max
  ) {

    return false;

  }


  hits.push(
    now
  );


  otpSendThrottle.set(
    identifier,
    hits
  );


  return true;

}


// =====================================================
// ISSUE OTP
// =====================================================

export function issueOtp(
  identifier: string,
  candidateId: string
) {

  const otp =
    String(
      Math.floor(
        100000 +
          Math.random() *
            900000
      )
    );


  const expiresAt =
    Date.now() +
    5 * 60 * 1000;


  otpStore.set(
    identifier,
    {

      otp,

      expiresAt,

      attempts: 0,

      candidateId,

    }
  );


  return {

    expiresAt:
      new Date(
        expiresAt
      ).toISOString(),

    demoOtp:
      process.env.NODE_ENV !==
      "production"
        ? otp
        : undefined,

  };

}


// =====================================================
// VERIFY OTP
// =====================================================

export function verifyStoredOtp(
  identifier: string,
  otp: string
) {

  const record =
    otpStore.get(
      identifier
    );


  if (!record) {

    return {
      ok: false,
      message:
        "No active verification request.",
    };

  }


  if (
    record.expiresAt <
    Date.now()
  ) {

    otpStore.delete(
      identifier
    );


    return {
      ok: false,
      message:
        "OTP has expired.",
    };

  }


  if (
    record.attempts >= 5
  ) {

    return {
      ok: false,
      message:
        "Too many attempts. Request a new OTP.",
    };

  }


  record.attempts += 1;


  if (
    record.otp !== otp
  ) {

    return {
      ok: false,
      message:
        "Invalid OTP.",
    };

  }


  otpStore.delete(
    identifier
  );


  const token =
    createStudentToken(
      record.candidateId
    );


  return {
    ok: true,
    token,
  };

}


// =====================================================
// INVITE TOKEN
// =====================================================

export function createInviteToken(
  candidateId: string
) {

  const token =
    crypto.randomUUID();


  inviteTokens.set(
    token,
    {

      candidateId,

      expiresAt:
        Date.now() +
        24 *
          60 *
          60 *
          1000,

    }
  );


  return token;

}


// =====================================================
// GET CANDIDATE BY INVITE TOKEN
// =====================================================

export function getCandidateByInviteToken(
  token?: string
) {

  if (!token) {
    return null;
  }


  const entry =
    inviteTokens.get(
      token
    );


  if (
    !entry ||
    entry.expiresAt <
      Date.now()
  ) {

    inviteTokens.delete(
      token
    );

    return null;

  }


  return (
    candidates.find(
      (candidate) =>
        candidate.id ===
        entry.candidateId
    ) ?? null
  );

}


// =====================================================
// CANDIDATE UPDATE
// =====================================================

export function updateCandidate(
  id: string,
  updater: (
    candidate: Candidate
  ) => Candidate
) {

  candidates =
    candidates.map(
      (candidate) =>
        candidate.id === id
          ? updater(
              clone(candidate)
            )
          : candidate
    );


  return (
    candidates.find(
      (candidate) =>
        candidate.id === id
    ) ?? null
  );

}


// =====================================================
// GET CANDIDATE
// =====================================================

export function getCandidate(
  id: string
) {

  return (
    candidates.find(
      (candidate) =>
        candidate.id === id
    ) ?? null
  );

}


// =====================================================
// INTERVIEW
// =====================================================

export function getInterview(
  id: string
) {

  return (
    interviews.find(
      (interview) =>
        interview.id === id
    ) ?? null
  );

}


// =====================================================
// SLOT
// =====================================================

export function getSlot(
  id: string
) {

  return (
    slots.find(
      (slot) =>
        slot.id === id
    ) ?? null
  );

}


// =====================================================
// PROJECT
// =====================================================

export function getProject(
  id: string
) {

  return (
    projects.find(
      (project) =>
        project.id === id
    ) ?? null
  );

}


// =====================================================
// CREATE PROJECT
// =====================================================

export function createProject(
  project: Omit<
    StoredProject,
    "id"
  >
) {

  const newProject:
    StoredProject = {

    id:
      `p-${crypto.randomUUID()}`,

    title:
      project.title,

    role:
      project.role,

    difficulty:
      project.difficulty,

    description:
      project.description,

    technologies:
      [...project.technologies],

    briefUrl:
      project.briefUrl,

    assignedCount:
      0,

    status:
      project.status,

  };


  projects.push(
    newProject
  );


  return newProject;

}


// =====================================================
// UPDATE PROJECT
// =====================================================

export function updateProject(
  id: string,
  updater: (
    project: StoredProject
  ) => StoredProject
) {

  const index =
    projects.findIndex(
      (project) =>
        project.id === id
    );


  if (index === -1) {
    return null;
  }


  projects[index] =
    updater(
      clone(
        projects[index]
      )
    );


  return projects[index];

}


// =====================================================
// DELETE PROJECT
// =====================================================

export function deleteProject(
  id: string
) {

  const index =
    projects.findIndex(
      (project) =>
        project.id === id
    );


  if (index === -1) {
    return null;
  }


  const [
    deletedProject,
  ] =
    projects.splice(
      index,
      1
    );


  return deletedProject;

}


// =====================================================
// FIND CANDIDATES ASSIGNED TO PROJECT
// =====================================================

export function getCandidatesForProject(
  projectId: string
) {

  return candidates.filter(
    (candidate) => {

      const assignedProjectId =
        candidate.assignedProject?.id ??
        (
          candidate as Candidate & {
            assignedProjectId?: string;
          }
        ).assignedProjectId;


      return (
        assignedProjectId ===
        projectId
      );

    }
  );

}


// =====================================================
// SYNC PROJECT ASSIGNED COUNT
// =====================================================

export function syncProjectAssignedCount(
  projectId: string
) {

  const project =
    getProject(
      projectId
    );


  if (!project) {
    return null;
  }


  const count =
    getCandidatesForProject(
      projectId
    ).length;


  project.assignedCount =
    count;


  return project;

}


// =====================================================
// ASSIGN PROJECT TO CANDIDATE
// =====================================================

export function assignProjectToCandidate(
  candidateId: string,
  projectId: string
) {

  const candidate =
    getCandidate(
      candidateId
    );


  if (!candidate) {
    return {
      ok: false as const,
      message:
        "Candidate not found.",
    };
  }


  const project =
    getProject(
      projectId
    );


  if (!project) {
    return {
      ok: false as const,
      message:
        "Project not found.",
    };
  }


  if (
    project.status ===
    "archived"
  ) {

    return {
      ok: false as const,
      message:
        "Archived projects cannot be assigned.",
    };

  }


  /*
   * Check existing project.
   */

  const oldProjectId =
    candidate.assignedProject?.id ??
    (
      candidate as Candidate & {
        assignedProjectId?: string;
      }
    ).assignedProjectId;


  /*
   * If the same project is already assigned,
   * don't increment assignedCount again.
   */

  if (
    oldProjectId ===
    projectId
  ) {

    syncProjectAssignedCount(
      projectId
    );


    return {
      ok: true as const,
      candidate,
      project,
    };

  }


  /*
   * Remove candidate from old project.
   */

  if (oldProjectId) {

    syncProjectAssignedCount(
      oldProjectId
    );

  }


  /*
   * Assign new project.
   */

  const updatedCandidate =
    updateCandidate(
      candidateId,
      (currentCandidate) => {

        const nextCandidate =
          currentCandidate as Candidate & {
            assignedProjectId?: string;
          };


        nextCandidate.assignedProject = {

          id:
            String(
              project.id
            ),

          title:
            String(
              project.title
            ),

          difficulty:
            project.difficulty,

        };


        /*
         * Keep this field for compatibility
         * with older candidate APIs.
         */

        nextCandidate.assignedProjectId =
          String(
            project.id
          );


        return nextCandidate;

      }
    );


  /*
   * Recalculate instead of simply +1.
   *
   * This prevents assignedCount from
   * becoming incorrect after reassignment.
   */

  syncProjectAssignedCount(
    projectId
  );


  return {
    ok: true as const,
    candidate:
      updatedCandidate,
    project:
      getProject(projectId),
  };

}


// =====================================================
// UNASSIGN PROJECT FROM CANDIDATE
// =====================================================

export function unassignProjectFromCandidate(
  candidateId: string
) {

  const candidate =
    getCandidate(
      candidateId
    );


  if (!candidate) {

    return {
      ok: false as const,
      message:
        "Candidate not found.",
    };

  }


  const oldProjectId =
    candidate.assignedProject?.id ??
    (
      candidate as Candidate & {
        assignedProjectId?: string;
      }
    ).assignedProjectId;


  if (!oldProjectId) {

    return {
      ok: true as const,
      candidate,
    };

  }


  const updatedCandidate =
    updateCandidate(
      candidateId,
      (currentCandidate) => {

        const nextCandidate =
          currentCandidate as Candidate & {
            assignedProjectId?: string;
          };


        delete nextCandidate.assignedProject;

        delete nextCandidate.assignedProjectId;


        return nextCandidate;

      }
    );


  syncProjectAssignedCount(
    oldProjectId
  );


  return {
    ok: true as const,
    candidate:
      updatedCandidate,
  };

}


// =====================================================
// NOTIFICATIONS
// =====================================================

export function addNotification(
  notification: Omit<
    NotificationItem,
    "id" | "timestamp"
  >
) {

  notifications.unshift({

    ...notification,

    id:
      crypto.randomUUID(),

    timestamp:
      new Date().toISOString(),

  });

}


// =====================================================
// REPORTS
// =====================================================

export function getReports():
  PerformanceReport[] {

  return interviews

    .filter(
      (interview) =>
        interview.status ===
          "completed" &&
        interview.scores &&
        interview.aiAnalysis
    )

    .map(
      (interview) => ({

        id:
          `r-${interview.id}`,

        candidateId:
          interview.candidateId,

        candidateName:
          interview.candidateName,

        interviewDate:
          interview.date,

        scores:
          interview.scores!,

        overallScore:
          interview.overallScore ??
          0,

        aiSummary:
          interview.aiAnalysis!
            .summary,

        strengths:
          interview.aiAnalysis!
            .strengths,

        improvements:
          interview.aiAnalysis!
            .improvements,

        aiRecommendation:
          interview.aiAnalysis!
            .recommendation,

        status:
          interview.reportStatus ??
          "pending",

        finalDecision:
          candidates.find(
            (candidate) =>
              candidate.id ===
              interview.candidateId
          )?.finalDecision ??
          "pending",

      })
    );

}


// =====================================================
// EXPORT STATE
// =====================================================

export {
  candidates,
  interviews,
  slots,
  admins,
  notifications,
  auditLogs,
};