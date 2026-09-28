// =====================================================
// CANDIDATE SERVICE
// =====================================================

import Candidate from "./candidate.model.js";
import crypto from "crypto";
import CandidatePortalToken from "./CandidatePortalToken.js";
import { URLsender } from "../../modules/whatsapp/whatsapp.controller.js";


// =====================================================
// FORMAT CANDIDATE FOR FRONTEND
// =====================================================

function formatCandidate(candidate) {

    if (!candidate) {
        return null;
    }


    // =================================================
    // AI RESUME DATA
    // =================================================

    const resumeCandidate =
        candidate.resumeData?.candidate || {};


    return {

        // =================================================
        // BASIC INFORMATION
        // =================================================

        id:
            candidate._id.toString(),

        name:
            candidate.name ||
            resumeCandidate.name ||
            "Unknown",

        phone:
            candidate.phone ||
            resumeCandidate.phone ||
            "Not available",

        email:
            candidate.email ||
            resumeCandidate.email ||
            "Not available",

        location:
            candidate.location ||
            resumeCandidate.location ||
            "Not available",


        // =================================================
        // APPLICATION INFORMATION
        // =================================================

        status:
            candidate.status ||
            "received",

        jdMatchScore:
            candidate.jdMatchScore ?? 0,

        role:
            candidate.role ||
            resumeCandidate.role ||
            "—",

        batch:
            candidate.batchId
                ? candidate.batchId.toString()
                : "—",

        receivedDate:
            candidate.createdAt,

        interviewStatus:
            candidate.interviewStatus ||
            "pending",


        // =================================================
        // RESUME / AI INFORMATION
        // =================================================

        education:
            resumeCandidate.education || [],

        skills:
            resumeCandidate.skills || [],

        experience:
            resumeCandidate.experience || [],

        projects:
            resumeCandidate.projects || [],

        certifications:
            resumeCandidate.certifications || [],

        // Additional information extracted by AI
        additional:
            resumeCandidate.additional || {},

        // Complete AI resume data
        resumeData:
            candidate.resumeData || null,


        // =================================================
        // VERIFICATION
        // =================================================

        verificationStatus:
            candidate.verificationStatus ||
            "pending",


        // =================================================
        // RESUME FILE
        // =================================================

        resumeFileName:
            candidate.resumeFileName,

        resumeUrl:
            candidate.resumeUrl,


        // =================================================
        // ACTIVITY
        // =================================================

        activity:
            candidate.activity || [],


        // =================================================
        // REJECTION
        // =================================================

        rejectionReason:
            candidate.rejectionReason,


        // =================================================
        // PROJECT / SUBMISSION
        // =================================================

        assignedProjectId:
        candidate.assignedProjectId
            ? candidate.assignedProjectId.toString()
            : null,

        submissionUrl:
            candidate.submissionUrl,

        interviewUrl:
            candidate.interviewUrl,


        // =================================================
        // DATES
        // =================================================

        createdAt:
            candidate.createdAt,

        updatedAt:
            candidate.updatedAt
    };
}


// =====================================================
// CREATE CANDIDATE
// =====================================================

export async function createCandidate(data) {

    try {

        const candidate =
            await Candidate.create({

                // =================================================
                // BASIC INFORMATION
                // =================================================

                name:
                    data.candidate?.name ??
                    "Unknown",

                // WhatsApp formatted phone number
                phone:
                    data.phone ??
                    data.candidate?.phone,

                email:
                    data.candidate?.email ??
                    undefined,

                location:
                    data.candidate?.location ??
                    undefined,

                role:
                    data.role ??
                    data.candidate?.role ??
                    undefined,


                // =================================================
                // APPLICATION STATUS
                // =================================================

                status:
                    data.status ??
                    "received",

                jdMatchScore:
                    data.jdMatchScore ??
                    data.candidate?.jdMatchScore ??
                    0,


                // =================================================
                // VERIFICATION
                // =================================================

                verificationStatus:
                    data.verificationStatus ??
                    "pending",


                // =================================================
                // RESUME FILE
                // =================================================

                resumeFileName:
                    data.resumeFileName,

                resumeUrl:
                    data.resumeUrl,


                // =================================================
                // AI RESUME DATA
                // =================================================

                // IMPORTANT:
                // Store BOTH:
                //
                // 1. raw       -> complete AI response
                // 2. candidate  -> extracted candidate data
                //
                // Because resume structures can be different.
                // =================================================

                resumeData: {

                    raw:
                        data.rawAIResult ??
                        data,

                    candidate:
                        data.candidate ??
                        {},

                    analyzedAt:
                        new Date()
                },


                // =================================================
                // ACTIVITY
                // =================================================

                activity:
                    data.activity ??
                    [],


                // =================================================
                // SUBMISSION
                // =================================================

                submissionUrl:
                    data.submissionUrl
            });


        console.log(
            "Candidate created:",
            candidate._id
        );


        return formatCandidate(candidate);

    } catch (error) {

        console.error(
            "Error creating candidate:",
            error
        );

        throw error;
    }
}


// =====================================================
// FIND EXISTING CANDIDATE
// CHECK PHONE OR EMAIL
// =====================================================

export async function findCandidateByPhone(
    phone,
    email
) {

    try {

        const conditions = [];


        if (phone) {

            conditions.push({
                phone: phone
            });
        }


        if (email) {

            conditions.push({
                email: email
            });
        }


        if (conditions.length === 0) {
            return null;
        }


        const candidate =
            await Candidate.findOne({
                $or: conditions
            });


        return candidate;

    } catch (error) {

        console.error(
            "Error checking duplicate candidate:",
            error
        );

        throw error;
    }
}


// =====================================================
// GET ALL CANDIDATES
// =====================================================

export async function getCandidates({

    search,

    status,

    role,

    batch,

    jdMatchMin,

    sortBy,

    sortDir,

    page = 1,

    pageSize = 6

}) {

    try {

        const filter = {};


        // =================================================
        // SEARCH
        // =================================================

        if (search) {

            filter.$or = [

                {
                    name: {
                        $regex: search,
                        $options: "i"
                    }
                },

                {
                    email: {
                        $regex: search,
                        $options: "i"
                    }
                },

                {
                    phone: {
                        $regex: search,
                        $options: "i"
                    }
                }

            ];
        }


        // =================================================
        // STATUS FILTER
        // =================================================

        if (
            status &&
            status !== "all"
        ) {

            filter.status = status;
        }


        // =================================================
        // ROLE FILTER
        // =================================================

        if (
            role &&
            role !== "all"
        ) {

            filter.role = role;
        }


        // =================================================
        // BATCH FILTER
        // =================================================

        if (
            batch &&
            batch !== "all"
        ) {

            filter.batchId = batch;
        }


        // =================================================
        // JD MATCH SCORE FILTER
        // =================================================

        if (
            jdMatchMin !== undefined &&
            jdMatchMin !== null &&
            jdMatchMin !== ""
        ) {

            filter.jdMatchScore = {
                $gte: Number(jdMatchMin)
            };
        }


        // =================================================
        // PAGINATION
        // =================================================

        const currentPage =
            Math.max(
                Number(page) || 1,
                1
            );


        const limit =
            Math.max(
                Number(pageSize) || 6,
                1
            );


        const skip =
            (currentPage - 1) *
            limit;


        // =================================================
        // SORT
        // =================================================

        const sortDirection =
            sortDir === "asc"
                ? 1
                : -1;


        let sort = {
            createdAt:
                sortDirection
        };


        if (
            sortBy === "name"
        ) {

            sort = {
                name:
                    sortDirection
            };

        } else if (
            sortBy === "jdMatchScore"
        ) {

            sort = {
                jdMatchScore:
                    sortDirection
            };

        } else if (
            sortBy === "receivedDate"
        ) {

            sort = {
                createdAt:
                    sortDirection
            };
        }


        // =================================================
        // DATABASE QUERY
        // =================================================

        const [
            candidates,
            total
        ] = await Promise.all([

            Candidate.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit),

            Candidate.countDocuments(
                filter
            )

        ]);


        // =================================================
        // FORMAT FOR FRONTEND
        // =================================================

        const formattedCandidates =
            candidates.map(
                formatCandidate
            );


        // =================================================
        // GET ROLES
        // =================================================

        const roles =
            await Candidate.distinct(
                "role"
            );


        // =================================================
        // GET BATCHES
        // =================================================

        const batches =
            await Candidate.distinct(
                "batchId"
            );


        // =================================================
        // RETURN
        // =================================================

        return {

            candidates:
                formattedCandidates,

            total,

            page:
                currentPage,

            pageSize:
                limit,

            roles:
                roles.filter(Boolean),

            batches:
                batches.filter(Boolean)

        };

    } catch (error) {

        console.error(
            "Error getting candidates:",
            error
        );

        throw error;
    }
}


// =====================================================
// GET CANDIDATE BY ID
// =====================================================

export async function getCandidateById(id) {

    try {

        const candidate =
            await Candidate.findById(id);


        if (!candidate) {
            return null;
        }


        return formatCandidate(
            candidate
        );

    } catch (error) {

        console.error(
            "Error getting candidate:",
            error
        );

        throw error;
    }
}


// =====================================================
// APPROVE CANDIDATE
// =====================================================

export async function approveCandidate(id) {

    try {

        // =================================================
        // 1. FIND CANDIDATE
        // =================================================

        const candidate =
            await Candidate.findById(id);


        if (!candidate) {
            return null;
        }


        // =================================================
        // 2. UPDATE CANDIDATE STATUS
        // =================================================

        candidate.status =
            "approved";


        await candidate.save();


        // =================================================
        // 3. GENERATE SECURE RANDOM TOKEN
        // =================================================

        const rawToken =
            crypto
                .randomBytes(32)
                .toString("hex");


        // =================================================
        // 4. HASH TOKEN
        // =================================================

        const tokenHash =
            crypto
                .createHash("sha256")
                .update(rawToken)
                .digest("hex");


        // =================================================
        // 5. SET TOKEN EXPIRY
        // 48 HOURS
        // =================================================

        const expiresAt =
            new Date(
                Date.now() +
                48 * 60 * 60 * 1000
            );


        // =================================================
        // 6. CREATE TOKEN RECORD
        // =================================================

        await CandidatePortalToken.create({

            candidateId:
                candidate._id,

            tokenHash:
                tokenHash,

            purpose:
                "candidate_portal",

            expiresAt:
                expiresAt

        });


        // =================================================
        // 7. CREATE CANDIDATE PORTAL URL
        // =================================================

        const portalUrl =
            `${process.env.FRONTEND_URL}/student/verify?token=${rawToken}`;


        // =================================================
        // 8. SEND WHATSAPP MESSAGE
        // =================================================

        await URLsender(
            candidate.phone,
            portalUrl,
            candidate.name
        );


        // =================================================
        // 9. RETURN
        // =================================================

        return {

            candidate,

            portalUrl

        };

    } catch (error) {

        console.error(
            "Error approving candidate:",
            error
        );

        throw error;
    }
}


// =====================================================
// REJECT CANDIDATE
// =====================================================

export async function rejectCandidate(
    id,
    reason
) {

    try {

        const candidate =
            await Candidate.findByIdAndUpdate(

                id,

                {
                    status:
                        "rejected",

                    rejectionReason:
                        reason
                },

                {
                    new: true,

                    runValidators: true
                }

            );


        if (!candidate) {
            return null;
        }


        return formatCandidate(
            candidate
        );

    } catch (error) {

        console.error(
            "Error rejecting candidate:",
            error
        );

        throw error;
    }
}


// =====================================================
// ASSIGN PROJECT TO CANDIDATE
// =====================================================
//
// This function is called after the project has been
// successfully created in MongoDB.
//
// Flow:
//
// 1. Admin generates project with AI
// 2. Project is shown in preview
// 3. Admin clicks Confirm & Save
// 4. Project is created in MongoDB
// 5. Frontend calls:
//       POST /api/candidates/:candidateId/project
// 6. This function stores the project ID on candidate
//
// =====================================================

export async function assignProjectToCandidate(
    candidateId,
    projectId
) {

    try {

        // =================================================
        // VALIDATE CANDIDATE ID
        // =================================================

        if (!candidateId) {

            throw new Error(
                "Candidate ID is required"
            );
        }


        // =================================================
        // VALIDATE PROJECT ID
        // =================================================

        if (!projectId) {

            throw new Error(
                "Project ID is required"
            );
        }


        // =================================================
        // FIND CANDIDATE
        // =================================================

        const candidate =
            await Candidate.findById(
                candidateId
            );


        if (!candidate) {

            return null;
        }


        // =================================================
        // ASSIGN PROJECT
        // =================================================

        candidate.assignedProjectId =
            projectId;

        candidate.status = "Project Assigned";
        // =================================================
        // SAVE CANDIDATE
        // =================================================

        await candidate.save();


        // =================================================
        // RETURN UPDATED CANDIDATE
        // =================================================

        return formatCandidate(
            candidate
        );

    } catch (error) {

        console.error(
            "Error assigning project to candidate:",
            error
        );

        throw error;
    }
}