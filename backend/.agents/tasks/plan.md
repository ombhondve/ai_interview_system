# Implementation Plan: Complete Student Functionality Audit and Fix

## Overview
Fix all student-related bugs across the AI Interview System backend, focusing on authentication, session handling, and status management issues.

## Key Issues Identified

### 1. Candidate Status Corruption Bug (CRITICAL)
**Problem**: After project assignment, candidate.status changes from "approved" to "Project Assigned", causing authentication failures.

**Root Cause**:
- `backend/src/modules/candidate/candidate.service.js`: `assignProjectToCandidate()` has buggy logic
- `backend/src/modules/student/student.service.js`: `updateCandidateProjectAssignment()` also sets wrong status

### 2. Cookie Configuration Issues
**Problem**: Logout controller uses hardcoded `SameSite=Lax` which won't work for cross-domain deployment.

### 3. Redundant Authentication Logic
**Problem**: `/api/student/me` endpoint manually parses cookies despite having middleware.

## Implementation Plan

### Phase 1: Fix Candidate Status Corruption (HIGH PRIORITY)

- [ ] **1. Fix `assignProjectToCandidate()` in candidate.service.js**
  - **File**: `backend/src/modules/candidate/candidate.service.js`
  - **Current Code** (lines 1371-1379):
    ```javascript
    const candidateStatusEnum = [
        "received", "under_review", "approved", "rejected",
        "Project Assigned", "Project Completed", "scheduled", 
        "completed", "decided"
    ];
    
    if (candidateStatusEnum.includes("Project Assigned")) {
        candidate.status = "Project Assigned";
    } else {
        if (candidate.status !== "completed") {
            candidate.status = "approved";
        }
    }
    ```
  - **Fix**: Remove the conditional logic. Always keep `candidate.status = "approved"` after project assignment.
  - **New Code**:
    ```javascript
    // Keep status as "approved" - project workflow is tracked separately
    // Project workflow is tracked in projectSubmissionStatus field
    candidate.status = "approved";
    candidate.projectSubmissionStatus = "not_started";
    candidate.assignedProjectId = projectId;
    candidate.projectAssignedAt = new Date();
    ```
  - **Verification**: Run existing candidate tests with `npm test` in backend directory.

- [ ] **2. Fix `updateCandidateProjectAssignment()` in student.service.js**
  - **File**: `backend/src/modules/student/student.service.js`
  - **Current Code** (lines 480-485):
    ```javascript
    {
        assignedProjectId: projectId,
        projectAssignedAt: new Date(),
        status: "Project Assigned",  // WRONG
        projectSubmissionStatus: "not_started"
    }
    ```
  - **Fix**: Change `status: "Project Assigned"` to `status: "approved"`
  - **New Code**:
    ```javascript
    {
        assignedProjectId: projectId,
        projectAssignedAt: new Date(),
        status: "approved",
        projectSubmissionStatus: "not_started"
    }
    ```
  - **Verification**: Run existing student service tests.

### Phase 2: Fix Cookie Configuration

- [ ] **3. Fix logout cookie settings in student.controller.js**
  - **File**: `backend/src/modules/student/student.controller.js`
  - **Current Code** (lines 253-260):
    ```javascript
    // Clear cookie
    res.setHeader('Set-Cookie', [
      'candidate_session=',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',  // WRONG for production cross-domain
      'Max-Age=0',
      'Path=/'
    ].join('; '));
    ```
  - **Fix**: Match the same cookie settings used in verification controller
  - **New Code**:
    ```javascript
    // Clear cookie with same settings as verification controller
    res.clearCookie('candidate_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 0
    });
    ```
  - **Verification**: Test logout functionality works in both development and production modes.

### Phase 3: Clean Up Redundant Authentication Logic

- [ ] **4. Simplify `getCurrentStudentController()` in student.controller.js**
  - **File**: `backend/src/modules/student/student.controller.js`
  - **Problem**: Controller manually parses cookies and calls `getCandidateBySessionToken()` despite having `requireVerifiedSession` middleware.
  - **Fix**: Remove manual cookie parsing and use `req.candidate` set by middleware
  - **Current Code**: Entire function needs rewriting (lines 83-159)
  - **New Code**:
    ```javascript
    export async function getCurrentStudentController(req, res) {
      try {
        const candidate = req.candidate;
        
        if (!candidate) {
          return res.status(401).json({
            message: "Student session expired.",
          });
        }
        
        return res.status(200).json({
          candidate: {
            id: candidate._id,
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone,
            role: candidate.role,
            status: candidate.status,
            jdMatchScore: candidate.jdMatchScore,
            interview: candidate.interview || null,
            // Add project-related fields for frontend
            assignedProjectId: candidate.assignedProjectId,
            projectSubmissionStatus: candidate.projectSubmissionStatus,
            projectAssignedAt: candidate.projectAssignedAt
          },
        });
      } catch (error) {
        console.error("Error getting current student:", error);
        return res.status(500).json({
          message: "Unable to verify student session.",
        });
      }
    }
    ```
  - **Also Remove**: The duplicate `extractSessionToken()` function at bottom of file (lines 312-334)
  - **Verification**: Test `/api/student/me` endpoint with valid session.

### Phase 4: Search for Other Status Issues

- [ ] **5. Search for any other `candidate.status = "Project Assigned"` or `"Project Completed"` assignments**
  - Use grep to find any remaining instances:
    ```bash
    grep -r "status.*=.*Project" backend/src/
    grep -r "Project Assigned" backend/src/
    grep -r "Project Completed" backend/src/
    ```
  - **Verification**: Confirm no other code changes candidate.status to project workflow values.

### Phase 5: Test Complete Student Flow

- [ ] **6. Test end-to-end student authentication flow**
  - **Steps**:
    1. Mock candidate approval and invitation generation
    2. Test `/api/student/invite?token=...` endpoint
    3. Test OTP sending and verification (`/api/verification/verify`)
    4. Verify `candidate_session` cookie is set correctly
    5. Test `/api/student/me` with valid session
    6. Test project assignment (should keep status as "approved")
    7. Test student remains authenticated after project assignment
    8. Test logout clears session correctly
  - **Verification**: All endpoints return expected status codes and data.

### Phase 6: Cross-Domain Cookie Testing

- [ ] **7. Test cookie behavior for cross-domain deployment**
  - **Frontend**: `https://ai-interview-system-dqc9.vercel.app`
  - **Backend**: `https://ai-interview-system-eewl.vercel.app`
  - **Test Cases**:
    1. Login sets cookie with `sameSite: "none"` and `secure: true`
    2. Cookie is sent with subsequent authenticated requests
    3. Logout clears cookie with matching settings
    4. CORS allows credentials from frontend origin
  - **Verification**: Cookies work correctly in cross-domain production environment.

## Risk Assessment

### High Risk
- **Status corruption fix**: Changing candidate status logic could affect other parts of system that depend on "Project Assigned" status display.
  - **Mitigation**: Only change the assignment logic, not the enum in model. Keep "Project Assigned" in enum for display/filtering purposes.

### Medium Risk  
- **Cookie changes**: Different SameSite settings between login/logout could cause logout issues.
  - **Mitigation**: Ensure both login and logout use identical cookie settings.

### Low Risk
- **Controller simplification**: Removing redundant code should not affect functionality since middleware already validates.

## Verification Commands

1. **Run backend tests**: `cd backend && npm test`
2. **Check for syntax errors**: `node -c src/server.js`
3. **Manual API testing sequence**:
   - Test invitation: `GET /api/student/invite?token=test`
   - Test OTP verification: `POST /api/verification/verify`
   - Test authenticated endpoints: `GET /api/student/me`
   - Test project assignment flow
   - Test logout: `POST /api/student/logout`

## Files to Modify

1. `backend/src/modules/candidate/candidate.service.js` - Fix assignProjectToCandidate()
2. `backend/src/modules/student/student.service.js` - Fix updateCandidateProjectAssignment()
3. `backend/src/modules/student/student.controller.js` - Fix logout cookie and simplify getCurrentStudentController()
4. (Potentially) Other files if grep search finds more status assignment issues

## Success Criteria

- Student remains authenticated after project assignment (status stays "approved")
- Logout works correctly in both dev and production
- `/api/student/me` returns correct data using middleware
- No regressions in existing student functionality
- Cross-domain cookies work in production deployment