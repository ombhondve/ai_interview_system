import express from "express";

import {
    getCandidatesController,
    getCandidateController,
    approveCandidateController,
    rejectCandidateController,
    assignProjectToCandidateController,
} from "./candidate.controller.js";


const router = express.Router();


// =====================================================
// GET ALL CANDIDATES
// =====================================================

router.get(
    "/",
    getCandidatesController
);


// =====================================================
// GET ONE CANDIDATE
// =====================================================

router.get(
    "/:id",
    getCandidateController
);


// =====================================================
// APPROVE CANDIDATE
// =====================================================

router.post(
    "/:id/approve",
    approveCandidateController
);


// =====================================================
// REJECT CANDIDATE
// =====================================================

router.post(
    "/:id/reject",
    rejectCandidateController
);


// =====================================================
// ASSIGN PROJECT TO CANDIDATE
//
// POST
// /api/candidates/:candidateId/project
//
// Body:
//
// {
//     "projectId": "PROJECT_ID"
// }
//
// This is called AFTER the project is saved
// in MongoDB.
//
// The route itself does not create the project.
// =====================================================

router.post(
    "/:candidateId/project",
    assignProjectToCandidateController
);


export default router;