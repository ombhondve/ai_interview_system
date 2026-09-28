import { NextResponse } from "next/server";

import {
  projects,
  candidates,
} from "@/lib/server-store";

import {
  requireAdmin,
} from "@/lib/auth-server";


// =====================================================
// GET ASSIGNED CANDIDATES
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

    requireAdmin();


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
          (candidate: any) => {

            const assignedProjectId =
              candidate.assignedProject?.id ??
              candidate.assignedProjectId;

            return (
              String(
                assignedProjectId
              ) ===
              String(project.id)
            );
          }
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

            jdMatchScore:
              Number(
                candidate.jdMatchScore ??
                0
              ),

            batch: String(
              candidate.batch ??
              candidate.batchId ??
              ""
            ),

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
                          .title ??
                          ""
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
    // UPDATE COUNT
    // -------------------------------------------------

    project.assignedCount =
      assignedCandidates.length;


    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    return NextResponse.json(
      {
        data:
          assignedCandidates,

        total:
          assignedCandidates.length,
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "GET /api/projects/[projectId]/candidates error:",
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