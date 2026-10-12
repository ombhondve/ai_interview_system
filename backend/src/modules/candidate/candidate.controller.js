import crypto from "node:crypto";
import Candidate from "./candidate.model.js";
import { notifyAdmins } from "../notifications/notification.service.js";
import { createAuditLog } from "../auditLog/auditLog.service.js";

import {
    getCandidates,
    getCandidateById,
    approveCandidate,
    rejectCandidate,
    assignProjectToCandidate
} from "./candidate.service.js";


// =====================================================
// GET ALL CANDIDATES
// =====================================================

export async function getCandidatesController(
    req,
    res
) {
    try {

        const {
            search,
            status,
            role,
            batch,
            jdMatchMin,
            sortBy,
            sortDir,
            page,
            pageSize
        } = req.query;


        const result = await getCandidates({
            search,
            status,
            role,
            batch,
            jdMatchMin,
            sortBy,
            sortDir,
            page,
            pageSize
        });


        return res.status(200).json({

            data: result.candidates,

            total: result.total,

            page: result.page,

            pageSize: result.pageSize,

            roles: result.roles,

            batches: result.batches

        });

    } catch (error) {

        console.error(
            "Error in getCandidatesController:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to get candidates",

            error:
                error.message

        });
    }
}


// =====================================================
// GET ONE CANDIDATE
// =====================================================

export async function getCandidateController(
    req,
    res
) {
    try {

        const candidate =
            await getCandidateById(
                req.params.id
            );


        if (!candidate) {

            return res.status(404).json({

                success: false,

                message:
                    "Candidate not found"

            });
        }


        return res.status(200).json(
            candidate
        );

    } catch (error) {

        console.error(
            "Error in getCandidateController:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to get candidate",

            error:
                error.message

        });
    }
}


// =====================================================
// APPROVE CANDIDATE
// =====================================================
//
// POST /api/candidates/:id/approve
//
// =====================================================

export async function approveCandidateController(
    req,
    res
) {
    try {

        const candidateId = req.params.id;


        // =================================================
        // VALIDATE CANDIDATE ID
        // =================================================

        if (!candidateId) {

            return res.status(400).json({

                success: false,

                message:
                    "Candidate ID is required"

            });
        }


        console.log(
            "Approving candidate:",
            candidateId
        );


        // =================================================
        // APPROVE CANDIDATE
        // =================================================

        const result =
            await approveCandidate(
                candidateId
            );


        console.log(
            "inside controller",
            result
        );


        // =================================================
        // VALIDATE RESULT
        // =================================================

        if (!result) {

            return res.status(404).json({

                success: false,

                message:
                    "Candidate not found"

            });
        }


        if (!result.candidate) {

            return res.status(404).json({

                success: false,

                message:
                    "Candidate not returned by approval service"

            });
        }


        // =================================================
        // CREATE APPROVAL ACTIVITY
        // =================================================

        const activity = {

            id:
                crypto.randomUUID(),

            label:
                "Approved",

            description:
                "Candidate is approved by the admin",

            state:
                "complete",

            timestamp:
                new Date()

        };


        // =================================================
        // ADD ACTIVITY TO MONGODB
        // =================================================

        const updatedCandidate =
            await Candidate.findByIdAndUpdate(

                candidateId,

                {
                    $push: {
                        activity: activity
                    }
                },

                {
                    new: true
                }

            );


        // =================================================
        // CHECK CANDIDATE UPDATE
        // =================================================

        if (!updatedCandidate) {

            return res.status(404).json({

                success: false,

                message:
                    "Candidate not found while updating activity"

            });
        }


        console.log(
            "Approval activity added successfully:",
            activity
        );


        // Dispatch notification
        notifyAdmins({
            type: "candidate_status_updated",
            title: "Candidate Approved",
            message: `${updatedCandidate.name || "Candidate"} was approved by an administrator.`,
            entityType: "candidate",
            entityId: String(updatedCandidate._id),
            actionUrl: `/admin/candidates/${updatedCandidate._id}`,
            dedupKeyPrefix: `cand_approved_${updatedCandidate._id}`,
        }).catch((err) => console.error("Notification error:", err.message));

        createAuditLog({
            actor: req.user?.id || "admin",
            actorId: req.user?.id,
            actorName: req.user?.name || req.user?.email || "Administrator",
            actorEmail: req.user?.email || "",
            actorRole: req.user?.role || "admin",
            action: "CANDIDATE_APPROVE",
            targetType: "Candidate",
            targetId: String(updatedCandidate._id),
            targetName: updatedCandidate.name || "Candidate",
            description: `Candidate ${updatedCandidate.name || ""} was approved by admin`,
            outcome: "SUCCESS",
            ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        }).catch(() => {});

        return res.status(200).json({

            success: true,

            message:
                "Candidate approved successfully",

            candidate:
                updatedCandidate,

            portalUrl:
                result.portalUrl || null

        });

    } catch (error) {

        console.error(
            "Error in approveCandidateController:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to approve candidate",

            error:
                error.message

        });
    }
}


// =====================================================
// REJECT CANDIDATE
// =====================================================
//
// POST /api/candidates/:id/reject
//
// Body:
//
// {
//     "reason": "Reason for rejection"
// }
//
// =====================================================

export async function rejectCandidateController(
    req,
    res
) {
    try {

        const {
            reason
        } = req.body || {};


        // =================================================
        // VALIDATE REASON
        // =================================================

        if (!reason) {

            return res.status(400).json({

                success: false,

                message:
                    "Rejection reason is required"

            });
        }


        // =================================================
        // REJECT CANDIDATE
        // =================================================

        const candidate =
            await rejectCandidate(
                req.params.id,
                reason
            );


        // =================================================
        // CANDIDATE NOT FOUND
        // =================================================

        if (!candidate) {

            return res.status(404).json({

                success: false,

                message:
                    "Candidate not found"

            });
        }


        notifyAdmins({
            type: "candidate_status_updated",
            title: "Candidate Rejected",
            message: `${candidate.name || "Candidate"} was rejected: ${reason}`,
            entityType: "candidate",
            entityId: String(candidate._id),
            actionUrl: `/admin/candidates/${candidate._id}`,
            dedupKeyPrefix: `cand_rejected_${candidate._id}`,
        }).catch((err) => console.error("Notification error:", err.message));

        createAuditLog({
            actor: req.user?.id || "admin",
            actorId: req.user?.id,
            actorName: req.user?.name || req.user?.email || "Administrator",
            actorEmail: req.user?.email || "",
            actorRole: req.user?.role || "admin",
            action: "CANDIDATE_REJECT",
            targetType: "Candidate",
            targetId: String(candidate._id),
            targetName: candidate.name || "Candidate",
            description: `Candidate ${candidate.name || ""} was rejected: ${reason}`,
            outcome: "SUCCESS",
            details: { reason },
            ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        }).catch(() => {});

        return res.status(200).json({

            success: true,

            candidate

        });

    } catch (error) {

        console.error(
            "Error in rejectCandidateController:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to reject candidate",

            error:
                error.message

        });
    }
}


// =====================================================
// ASSIGN PROJECT TO CANDIDATE
// =====================================================
//
// POST /api/candidates/:candidateId/project
//
// Body:
//
// {
//     "projectId": "PROJECT_ID"
// }
//
// =====================================================

export async function assignProjectToCandidateController(
    req,
    res
) {
    try {

        const {
            candidateId
        } = req.params;


        const {
            projectId
        } = req.body || {};


        // =================================================
        // VALIDATE CANDIDATE ID
        // =================================================

        if (!candidateId) {

            return res.status(400).json({

                success: false,

                message:
                    "Candidate ID is required"

            });
        }


        // =================================================
        // VALIDATE PROJECT ID
        // =================================================

        if (!projectId) {

            return res.status(400).json({

                success: false,

                message:
                    "Project ID is required"

            });
        }


        console.log(
            "Assigning project to candidate:",
            {
                candidateId,
                projectId
            }
        );


        // =================================================
        // ASSIGN PROJECT
        // =================================================

        const candidate =
            await assignProjectToCandidate(
                candidateId,
                projectId
            );


        // =================================================
        // CANDIDATE NOT FOUND
        // =================================================

        if (!candidate) {

            return res.status(404).json({

                success: false,

                message:
                    "Candidate not found"

            });
        }


        console.log(
            "Project assigned successfully:",
            {
                candidateId,
                projectId
            }
        );


        // =================================================
        // CREATE PROJECT ASSIGNMENT ACTIVITY
        // =================================================

        const activity = {

            id:
                crypto.randomUUID(),

            label:
                "Project Assigned",

            description:
                "Project assigned to the candidate by admin",

            state:
                "complete",

            timestamp:
                new Date()

        };


        // =================================================
        // ADD ACTIVITY TO MONGODB
        // =================================================

        const updatedCandidate =
            await Candidate.findByIdAndUpdate(

                candidateId,

                {
                    $push: {
                        activity: activity
                    }
                },

                {
                    new: true
                }

            );


        // =================================================
        // CHECK UPDATE
        // =================================================

        if (!updatedCandidate) {

            return res.status(404).json({

                success: false,

                message:
                    "Candidate not found while updating activity"

            });
        }


        console.log(
            "Project assignment activity added successfully:",
            activity
        );


        notifyAdmins({
            type: "project_assigned",
            title: "Project Assigned",
            message: `Project assigned to candidate ${updatedCandidate.name || "Candidate"}.`,
            entityType: "project",
            entityId: String(projectId),
            actionUrl: `/admin/projects/${projectId}`,
            dedupKeyPrefix: `proj_assign_${candidateId}_${projectId}`,
        }).catch((err) => console.error("Notification error:", err.message));

        createAuditLog({
            actor: req.user?.id || "admin",
            actorId: req.user?.id,
            actorName: req.user?.name || req.user?.email || "Administrator",
            actorEmail: req.user?.email || "",
            actorRole: req.user?.role || "admin",
            action: "PROJECT_ASSIGN",
            targetType: "Candidate",
            targetId: String(candidateId),
            targetName: updatedCandidate.name || "Candidate",
            description: `Project ${projectId} was assigned to candidate ${updatedCandidate.name || ""}`,
            outcome: "SUCCESS",
            details: { projectId: String(projectId), candidateId: String(candidateId) },
            ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        }).catch(() => {});

        return res.status(200).json({

            success: true,

            message:
                "Project assigned to candidate successfully",

            candidate:
                updatedCandidate

        });

    } catch (error) {

        console.error(
            "Error in assignProjectToCandidateController:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to assign project to candidate",

            error:
                error.message

        });
    }
}