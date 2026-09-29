// =====================================================
// CANDIDATE SERVICE
// =====================================================

import crypto from "node:crypto";

import Candidate from "./candidate.model.js";
import CandidatePortalToken from "./CandidatePortalToken.js";

import {
    sendWhatsAppMessage
} from "../../modules/whatsapp/whatsapp.service.js";


// =====================================================
// CONSTANTS
// =====================================================

const PORTAL_TOKEN_EXPIRY_HOURS = 48;


// =====================================================
// GENERIC HELPERS
// =====================================================

function cleanString(value) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value).trim();
}


function normalizeEmail(email) {
    const value = cleanString(email);

    return value
        ? value.toLowerCase()
        : "";
}


function normalizePhone(phone) {
    const value = cleanString(phone);

    if (!value) {
        return "";
    }

    return value.startsWith("+")
        ? value
        : `+${value}`;
}


/**
 * Convert common AI output variations into arrays.
 *
 * Examples:
 *
 * "Python, JavaScript"
 *     -> ["Python", "JavaScript"]
 *
 * ["Python", "JavaScript"]
 *     -> ["Python", "JavaScript"]
 *
 * [{...}]
 *     -> [{...}]
 */
function normalizeArray(value) {
    if (value === undefined || value === null) {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        const text = value.trim();

        if (!text) {
            return [];
        }

        return text
            .split(/\n|,|;/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [value];
}


/**
 * Preserve structured objects while normalizing primitive values.
 *
 * We do NOT invent schema-specific properties here.
 */
function normalizeStructuredArray(value) {
    if (value === undefined || value === null) {
        return [];
    }

    if (Array.isArray(value)) {
        return value
            .filter(
                (item) =>
                    item !== undefined &&
                    item !== null &&
                    item !== ""
            );
    }

    if (typeof value === "string") {
        const text = value.trim();

        if (!text) {
            return [];
        }

        return [text];
    }

    return [value];
}


/**
 * Normalize the candidate object returned by AI.
 *
 * This keeps the AI structure instead of destroying information.
 */
function normalizeResumeCandidate(candidate) {
    if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
    ) {
        return {};
    }

    const normalized = {
        ...candidate
    };


    if (normalized.name !== undefined) {
        normalized.name =
            cleanString(normalized.name);
    }


    if (normalized.phone !== undefined) {
        normalized.phone =
            normalizePhone(normalized.phone);
    }


    if (normalized.email !== undefined) {
        normalized.email =
            normalizeEmail(normalized.email);
    }


    if (normalized.location !== undefined) {
        normalized.location =
            cleanString(normalized.location);
    }


    if (normalized.role !== undefined) {
        normalized.role =
            cleanString(normalized.role);
    }


    /*
     * Keep these fields as arrays.
     *
     * Structured objects returned by AI remain unchanged.
     */
    if ("education" in normalized) {
        normalized.education =
            normalizeStructuredArray(
                normalized.education
            );
    }


    if ("experience" in normalized) {
        normalized.experience =
            normalizeStructuredArray(
                normalized.experience
            );
    }


    if ("projects" in normalized) {
        normalized.projects =
            normalizeStructuredArray(
                normalized.projects
            );
    }


    if ("certifications" in normalized) {
        normalized.certifications =
            normalizeStructuredArray(
                normalized.certifications
            );
    }


    if ("skills" in normalized) {
        normalized.skills =
            normalizeArray(
                normalized.skills
            );
    }


    if (
        normalized.additional === undefined ||
        normalized.additional === null
    ) {
        normalized.additional = {};
    }


    return normalized;
}


// =====================================================
// FORMAT CANDIDATE FOR FRONTEND
// =====================================================

function formatCandidate(candidate) {

    if (!candidate) {
        return null;
    }


    const resumeCandidate =
        candidate.resumeData?.candidate || {};


    return {

        // =================================================
        // BASIC INFORMATION
        // =================================================

        id:
            candidate._id?.toString(),

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

        additional:
            resumeCandidate.additional || {},

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

        if (
            !data ||
            typeof data !== "object"
        ) {
            throw new Error(
                "Candidate data is required."
            );
        }


        // =================================================
        // NORMALIZE CANDIDATE DATA
        // =================================================

        const normalizedCandidate =
            normalizeResumeCandidate(
                data.candidate
            );


        // =================================================
        // PHONE
        // =================================================

        const phone =
            normalizePhone(
                data.phone ||
                normalizedCandidate.phone
            );


        if (!phone) {
            throw new Error(
                "Candidate phone number is required."
            );
        }


        normalizedCandidate.phone =
            phone;


        // =================================================
        // EMAIL
        // =================================================

        const email =
            normalizeEmail(
                data.email ||
                normalizedCandidate.email
            );


        if (email) {
            normalizedCandidate.email =
                email;
        }


        // =================================================
        // DUPLICATE CHECK
        //
        // This protects against race conditions where
        // controller-level duplicate checking happened
        // slightly earlier.
        // =================================================

        const existingCandidate =
            await findCandidateByPhone(
                phone,
                email || undefined
            );


        if (existingCandidate) {

            console.log(
                "Candidate already exists:",
                existingCandidate._id
            );

            return formatCandidate(
                existingCandidate
            );
        }


        // =================================================
        // RAW AI DATA
        // =================================================

        const rawAIResult =
            data.rawAIResult ??
            data;


        // =================================================
        // CREATE CANDIDATE
        // =================================================

        const candidate =
            await Candidate.create({

                // =================================================
                // BASIC INFORMATION
                // =================================================

                name:
                    cleanString(
                        data.name ||
                        normalizedCandidate.name
                    ) ||
                    "Unknown",

                phone,

                email:
                    email || undefined,

                location:
                    cleanString(
                        data.location ||
                        normalizedCandidate.location
                    ) ||
                    undefined,

                role:
                    cleanString(
                        data.role ||
                        normalizedCandidate.role
                    ) ||
                    undefined,


                // =================================================
                // APPLICATION STATUS
                // =================================================

                status:
                    data.status ||
                    "received",

                jdMatchScore:
                    Number(
                        data.jdMatchScore ??
                        normalizedCandidate.jdMatchScore ??
                        0
                    ),


                // =================================================
                // VERIFICATION
                // =================================================

                verificationStatus:
                    data.verificationStatus ||
                    "pending",


                // =================================================
                // RESUME FILE
                // =================================================

                resumeFileName:
                    data.resumeFileName ||
                    undefined,

                resumeUrl:
                    data.resumeUrl ||
                    undefined,


                // =================================================
                // AI RESUME DATA
                // =================================================

                resumeData: {

                    raw:
                        rawAIResult,

                    candidate:
                        normalizedCandidate,

                    analyzedAt:
                        new Date()
                },


                // =================================================
                // ACTIVITY
                // =================================================

                activity:
                    Array.isArray(data.activity)
                        ? data.activity
                        : [],


                // =================================================
                // SUBMISSION
                // =================================================

                submissionUrl:
                    data.submissionUrl ||
                    undefined
            });


        console.log(
            "Candidate created successfully:",
            candidate._id
        );


        return formatCandidate(
            candidate
        );

    } catch (error) {

        console.error(
            "Error creating candidate:",
            error?.stack ||
            error?.message ||
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

        const normalizedPhone =
            normalizePhone(phone);

        const normalizedEmail =
            normalizeEmail(email);


        const conditions = [];


        if (normalizedPhone) {

            conditions.push({
                phone:
                    normalizedPhone
            });
        }


        if (normalizedEmail) {

            conditions.push({
                email:
                    normalizedEmail
            });
        }


        if (
            conditions.length === 0
        ) {
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
            error?.stack ||
            error?.message ||
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

            const searchValue =
                cleanString(search);

            filter.$or = [

                {
                    name: {
                        $regex:
                            searchValue,
                        $options: "i"
                    }
                },

                {
                    email: {
                        $regex:
                            searchValue,
                        $options: "i"
                    }
                },

                {
                    phone: {
                        $regex:
                            searchValue,
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

            filter.status =
                status;
        }


        // =================================================
        // ROLE FILTER
        // =================================================

        if (
            role &&
            role !== "all"
        ) {

            filter.role =
                role;
        }


        // =================================================
        // BATCH FILTER
        // =================================================

        if (
            batch &&
            batch !== "all"
        ) {

            filter.batchId =
                batch;
        }


        // =================================================
        // JD MATCH SCORE FILTER
        // =================================================

        if (
            jdMatchMin !== undefined &&
            jdMatchMin !== null &&
            jdMatchMin !== ""
        ) {

            const minimumScore =
                Number(jdMatchMin);

            if (
                Number.isFinite(
                    minimumScore
                )
            ) {
                filter.jdMatchScore = {
                    $gte:
                        minimumScore
                };
            }
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
            error?.stack ||
            error?.message ||
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

        if (!id) {
            throw new Error(
                "Candidate ID is required."
            );
        }


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
            error?.stack ||
            error?.message ||
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


        if (!candidate.phone) {
            throw new Error(
                "Candidate does not have a WhatsApp phone number."
            );
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
        // =================================================

        const expiresAt =
            new Date(
                Date.now() +
                PORTAL_TOKEN_EXPIRY_HOURS *
                60 *
                60 *
                1000
            );


        // =================================================
        // 6. CREATE TOKEN RECORD
        // =================================================

        await CandidatePortalToken.create({

            candidateId:
                candidate._id,

            tokenHash,

            purpose:
                "candidate_portal",

            expiresAt
        });


        // =================================================
        // 7. CREATE CANDIDATE PORTAL URL
        // =================================================

        const frontendUrl =
            cleanString(
                process.env.FRONTEND_URL
            ).replace(/\/+$/, "");


        if (!frontendUrl) {
            throw new Error(
                "FRONTEND_URL is not configured."
            );
        }


        const portalUrl =
            `${frontendUrl}/student/verify?token=${encodeURIComponent(rawToken)}`;


        // =================================================
        // 8. SEND WHATSAPP MESSAGE
        // =================================================

        const message =
            `Hello ${candidate.name || "Candidate"},

Your application has been approved for the next stage of the recruitment process.

Please select your interview slot using the link below:

🔗 Candidate Portal
${portalUrl}

Please complete your slot selection before the link expires.

Important:
• This link is unique to you.
• Please do not share it with anyone.
• This is an automated message. Please do not reply.

For any questions, please contact the recruitment team through the official communication channel.

Regards,
RecruitAI Team`;


        await sendWhatsAppMessage(
            candidate.phone,
            message
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
            error?.stack ||
            error?.message ||
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

        const rejectionReason =
            cleanString(reason);


        const candidate =
            await Candidate.findByIdAndUpdate(

                id,

                {
                    status:
                        "rejected",

                    rejectionReason:
                        rejectionReason
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
            error?.stack ||
            error?.message ||
            error
        );

        throw error;
    }
}


// =====================================================
// ASSIGN PROJECT TO CANDIDATE
// =====================================================
//
// Flow:
//
// 1. Admin generates project with AI
// 2. Project is shown in preview
// 3. Admin clicks Confirm & Save
// 4. Project is created in MongoDB
// 5. Frontend calls:
//      POST /api/candidates/:candidateId/project
// 6. Project ID is stored on candidate
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
                "Candidate ID is required."
            );
        }


        // =================================================
        // VALIDATE PROJECT ID
        // =================================================

        if (!projectId) {
            throw new Error(
                "Project ID is required."
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


        /*
         * Do not blindly use "Project Assigned".
         *
         * Your Candidate schema may use an enum.
         * "approved" is already part of the existing
         * application flow and is safer than inventing
         * another status value.
         */
        if (
            candidate.status !==
            "completed"
        ) {
            candidate.status =
                "approved";
        }


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
            error?.stack ||
            error?.message ||
            error
        );

        throw error;
    }
}