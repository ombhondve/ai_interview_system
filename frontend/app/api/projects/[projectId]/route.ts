import { NextResponse } from "next/server";

import {
  projects,
  candidates,
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

type ProjectStatus =
  | "active"
  | "archived";


// =====================================================
// FORMAT PROJECT
// =====================================================

function formatProject(project: any) {
  return {
    id: String(project.id),

    title: String(
      project.title ?? ""
    ),

    role: String(
      project.role ?? ""
    ),

    difficulty:
      project.difficulty ??
      "junior",

    description: String(
      project.description ?? ""
    ),

    technologies:
      Array.isArray(
        project.technologies
      )
        ? project.technologies.map(
            (technology: unknown) =>
              String(technology)
          )
        : [],

    briefUrl: String(
      project.briefUrl ?? ""
    ),

    /*
     * server-store uses assignedCount.
     * Frontend uses assigned.
     */
    assigned:
      Number(
        project.assignedCount ??
        project.assigned ??
        0
      ),

    status:
      project.status ??
      "active",
  };
}


// =====================================================
// GET SINGLE PROJECT
// =====================================================

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: {
      projectId: string;
    };
  }
) {
  try {

    // -------------------------------------------------
    // AUTHENTICATION
    // -------------------------------------------------

    await requireAdmin();


    // -------------------------------------------------
    // FIND PROJECT
    // -------------------------------------------------

    const project =
      projects.find(
        (item: any) =>
          String(item.id) ===
          String(params.projectId)
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
    // FIND ASSIGNED CANDIDATES
    // -------------------------------------------------

    const assignedCandidates =
      candidates
        .filter(
          (candidate: any) =>
            candidate.assignedProject?.id ===
              project.id ||
            candidate.assignedProjectId ===
              project.id
        )
        .map(
          (candidate: any) => ({
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
              candidate.assignedProject
                ? {
                    id:
                      String(
                        candidate
                          .assignedProject
                          .id
                      ),

                    title:
                      String(
                        candidate
                          .assignedProject
                          .title ?? ""
                      ),

                    difficulty:
                      candidate
                        .assignedProject
                        .difficulty,
                  }
                : undefined,
          })
        );


    // -------------------------------------------------
    // KEEP ASSIGNMENT COUNT IN SYNC
    // -------------------------------------------------

    project.assignedCount =
      assignedCandidates.length;


    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    return NextResponse.json(
      {
        ...formatProject(project),

        assignedCandidates,
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "GET /api/projects/[projectId] error:",
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
// PATCH PROJECT
// =====================================================

export async function PATCH(
  req: Request,
  {
    params,
  }: {
    params: {
      projectId: string;
    };
  }
) {
  try {

    // -------------------------------------------------
    // AUTHENTICATION
    // -------------------------------------------------

    const admin =
      await requireAdmin();


    // -------------------------------------------------
    // FIND PROJECT
    // -------------------------------------------------

    const project =
      projects.find(
        (item: any) =>
          String(item.id) ===
          String(params.projectId)
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
    // REQUEST BODY
    // -------------------------------------------------

    const body =
      await req.json();


    // -------------------------------------------------
    // READ VALUES
    // -------------------------------------------------

    const title =
      body.title !== undefined
        ? String(
            body.title
          ).trim()
        : String(
            project.title ?? ""
          ).trim();


    const role =
      body.role !== undefined
        ? String(
            body.role
          ).trim()
        : String(
            project.role ?? ""
          ).trim();


    const description =
      body.description !==
      undefined
        ? String(
            body.description
          ).trim()
        : String(
            project.description ??
              ""
          ).trim();


    const briefUrl =
      body.briefUrl !== undefined
        ? String(
            body.briefUrl
          ).trim()
        : String(
            project.briefUrl ?? ""
          ).trim();


    const difficulty =
      body.difficulty !==
      undefined
        ? body.difficulty
        : project.difficulty ??
          "junior";


    const status =
      body.status !== undefined
        ? body.status
        : project.status ??
          "active";


    const technologies =
      body.technologies !==
      undefined
        ? Array.isArray(
            body.technologies
          )
          ? body.technologies
              .map(
                (
                  technology: unknown
                ) =>
                  String(
                    technology
                  ).trim()
              )
              .filter(Boolean)
          : []
        : Array.isArray(
            project.technologies
          )
        ? project.technologies
        : [];


    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!title) {
      return NextResponse.json(
        {
          message:
            "Project title is required.",
        },
        {
          status: 400,
        }
      );
    }


    if (!role) {
      return NextResponse.json(
        {
          message:
            "Project role is required.",
        },
        {
          status: 400,
        }
      );
    }


    if (!description) {
      return NextResponse.json(
        {
          message:
            "Project description is required.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      ![
        "junior",
        "mid",
        "senior",
      ].includes(difficulty)
    ) {
      return NextResponse.json(
        {
          message:
            "Difficulty must be junior, mid, or senior.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      ![
        "active",
        "archived",
      ].includes(status)
    ) {
      return NextResponse.json(
        {
          message:
            "Status must be active or archived.",
        },
        {
          status: 400,
        }
      );
    }


    // -------------------------------------------------
    // UPDATE ALLOWED FIELDS ONLY
    // -------------------------------------------------

    project.title =
      title;

    project.role =
      role;

    project.difficulty =
      difficulty as Difficulty;

    project.description =
      description;

    project.technologies =
      technologies;

    project.briefUrl =
      briefUrl;

    project.status =
      status as ProjectStatus;


    // -------------------------------------------------
    // AUDIT LOG
    // -------------------------------------------------

    addAudit(
      admin.name,
      "update_project",
      project.title,
      "projects"
    );


    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    return NextResponse.json(
      formatProject(project),
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "PATCH /api/projects/[projectId] error:",
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
// DELETE PROJECT
// =====================================================

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: {
      projectId: string;
    };
  }
) {
  try {

    // -------------------------------------------------
    // AUTHENTICATION
    // -------------------------------------------------

    const admin =
      await requireAdmin();


    // -------------------------------------------------
    // FIND PROJECT
    // -------------------------------------------------

    const projectIndex =
      projects.findIndex(
        (item: any) =>
          String(item.id) ===
          String(params.projectId)
      );


    if (projectIndex === -1) {
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


    const project =
      projects[projectIndex];


    // -------------------------------------------------
    // CHECK ASSIGNED CANDIDATES
    // -------------------------------------------------

    const assignedCandidates =
      candidates.filter(
        (candidate: any) =>
          candidate.assignedProject?.id ===
            project.id ||
          candidate.assignedProjectId ===
            project.id
      );


    if (
      assignedCandidates.length > 0
    ) {
      return NextResponse.json(
        {
          message:
            `Cannot delete this project because ${assignedCandidates.length} candidate(s) are currently assigned to it.`,
        },
        {
          status: 409,
        }
      );
    }


    // -------------------------------------------------
    // DELETE PROJECT
    // -------------------------------------------------

    projects.splice(
      projectIndex,
      1
    );


    // -------------------------------------------------
    // AUDIT LOG
    // -------------------------------------------------

    addAudit(
      admin.name,
      "delete_project",
      project.title,
      "projects",
      "warning"
    );


    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    return NextResponse.json(
      {
        message:
          "Project deleted successfully.",
        project:
          formatProject(project),
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "DELETE /api/projects/[projectId] error:",
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