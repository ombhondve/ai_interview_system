import { NextResponse } from "next/server";

import {
  candidates,
  projects,
  addAudit,
} from "@/lib/server-store";

import {
  requireAdmin,
} from "@/lib/auth-server";


// =====================================================
// TYPES
// =====================================================

type Difficulty =
  | "junior"
  | "mid"
  | "senior";


// =====================================================
// POST
// ASSIGN PROJECT TO CANDIDATE
// =====================================================

export async function POST(
  req: Request,
  {
    params,
  }: {
    params: {
      candidateId: string;
    };
  }
) {
  try {

    // -------------------------------------------------
    // AUTHENTICATION
    // -------------------------------------------------

    const admin =
      requireAdmin();


    // -------------------------------------------------
    // FIND CANDIDATE
    // -------------------------------------------------

    const candidate =
      candidates.find(
        (item: any) =>
          String(item.id) ===
          String(params.candidateId)
      );


    if (!candidate) {

      return NextResponse.json(
        {
          message:
            "Candidate not found.",
        },
        {
          status: 404,
        }
      );

    }


    // -------------------------------------------------
    // REQUEST BODY
    // -------------------------------------------------

    const body =
      await req.json();


    const projectId =
      String(
        body.projectId ?? ""
      ).trim();


    if (!projectId) {

      return NextResponse.json(
        {
          message:
            "Project ID is required.",
        },
        {
          status: 400,
        }
      );

    }


    // -------------------------------------------------
    // FIND PROJECT
    // -------------------------------------------------

    const project =
      projects.find(
        (item: any) =>
          String(item.id) ===
          projectId
      );


    if (!project) {

      return NextResponse.json(
        {
          message:
            "Project not found.",
        },
        {
          status: 404,
        }
      );

    }


    // -------------------------------------------------
    // CHECK PROJECT STATUS
    // -------------------------------------------------

    if (
      project.status ===
      "archived"
    ) {

      return NextResponse.json(
        {
          message:
            "Archived projects cannot be assigned.",
        },
        {
          status: 400,
        }
      );

    }


    // -------------------------------------------------
    // CHECK EXISTING ASSIGNMENT
    // -------------------------------------------------

    const existingProjectId =
      candidate.assignedProject?.id ??
      candidate.assignedProjectId;


    if (
      existingProjectId ===
      project.id
    ) {

      return NextResponse.json(
        {
          message:
            "This project is already assigned to the candidate.",
        },
        {
          status: 409,
        }
      );

    }


    // -------------------------------------------------
    // REMOVE OLD PROJECT COUNT
    // -------------------------------------------------

    if (
      existingProjectId &&
      existingProjectId !==
        project.id
    ) {

      const oldProject =
        projects.find(
          (item: any) =>
            String(item.id) ===
            String(existingProjectId)
        );


      if (oldProject) {

        oldProject.assignedCount =
          Math.max(
            0,
            Number(
              oldProject.assignedCount ??
              oldProject.assigned ??
              0
            ) - 1
          );

      }

    }


    // -------------------------------------------------
    // ASSIGN NEW PROJECT
    // -------------------------------------------------

    candidate.assignedProject = {
      id: String(
        project.id
      ),

      title: String(
        project.title
      ),

      difficulty:
        project.difficulty as Difficulty,
    };


    // -------------------------------------------------
    // KEEP COMPATIBILITY
    // -------------------------------------------------

    candidate.assignedProjectId =
      String(project.id);


    // -------------------------------------------------
    // UPDATE PROJECT COUNT
    // -------------------------------------------------

    project.assignedCount =
      Number(
        project.assignedCount ??
        project.assigned ??
        0
      ) + 1;


    // -------------------------------------------------
    // AUDIT LOG
    // -------------------------------------------------

    addAudit(
      admin.name,
      "assign_project",
      candidate.name,
      "projects",
      "info",
      `Assigned project "${project.title}" to candidate "${candidate.name}".`
    );


    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    return NextResponse.json(
      {
        message:
          "Project assigned successfully.",

        candidate: {
          id: String(
            candidate.id
          ),

          name: String(
            candidate.name ?? ""
          ),

          email: String(
            candidate.email ?? ""
          ),

          phone: String(
            candidate.phone ?? ""
          ),

          role: String(
            candidate.role ?? ""
          ),

          status:
            candidate.status,

          assignedProject:
            candidate.assignedProject,

          assignedProjectId:
            candidate.assignedProjectId,
        },

        project: {
          id: String(
            project.id
          ),

          title: String(
            project.title
          ),

          role: String(
            project.role
          ),

          difficulty:
            project.difficulty,

          description:
            String(
              project.description ??
                ""
            ),

          technologies:
            Array.isArray(
              project.technologies
            )
              ? project.technologies
              : [],

          briefUrl:
            String(
              project.briefUrl ??
                ""
            ),

          assigned:
            Number(
              project.assignedCount ??
              0
            ),

          status:
            project.status,
        },
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "POST /api/candidates/[candidateId]/project error:",
      error
    );


    return NextResponse.json(
      {
        message:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }
}


// =====================================================
// DELETE
// REMOVE PROJECT FROM CANDIDATE
// =====================================================

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: {
      candidateId: string;
    };
  }
) {
  try {

    // -------------------------------------------------
    // AUTHENTICATION
    // -------------------------------------------------

    const admin =
      requireAdmin();


    // -------------------------------------------------
    // FIND CANDIDATE
    // -------------------------------------------------

    const candidate =
      candidates.find(
        (item: any) =>
          String(item.id) ===
          String(params.candidateId)
      );


    if (!candidate) {

      return NextResponse.json(
        {
          message:
            "Candidate not found.",
        },
        {
          status: 404,
        }
      );

    }


    // -------------------------------------------------
    // FIND CURRENT PROJECT
    // -------------------------------------------------

    const projectId =
      candidate.assignedProject?.id ??
      candidate.assignedProjectId;


    if (!projectId) {

      return NextResponse.json(
        {
          message:
            "No project is currently assigned to this candidate.",
        },
        {
          status: 404,
        }
      );

    }


    const project =
      projects.find(
        (item: any) =>
          String(item.id) ===
          String(projectId)
      );


    // -------------------------------------------------
    // REMOVE PROJECT ASSIGNMENT
    // -------------------------------------------------

    delete candidate.assignedProject;

    delete candidate.assignedProjectId;


    // -------------------------------------------------
    // UPDATE PROJECT COUNT
    // -------------------------------------------------

    if (project) {

      project.assignedCount =
        Math.max(
          0,
          Number(
            project.assignedCount ??
            project.assigned ??
            0
          ) - 1
        );

    }


    // -------------------------------------------------
    // AUDIT LOG
    // -------------------------------------------------

    addAudit(
      admin.name,
      "unassign_project",
      candidate.name,
      "projects",
      "warning",
      project
        ? `Removed project "${project.title}" from candidate "${candidate.name}".`
        : `Removed project assignment from candidate "${candidate.name}".`
    );


    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    return NextResponse.json(
      {
        message:
          "Project removed successfully.",

        candidate: {
          id: String(
            candidate.id
          ),

          name: String(
            candidate.name ?? ""
          ),

          email: String(
            candidate.email ?? ""
          ),

          phone: String(
            candidate.phone ?? ""
          ),

          role: String(
            candidate.role ?? ""
          ),

          status:
            candidate.status,
        },
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "DELETE /api/candidates/[candidateId]/project error:",
      error
    );


    return NextResponse.json(
      {
        message:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }
}