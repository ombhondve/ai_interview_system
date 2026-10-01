"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Modal,
} from "@/components/ui/Modal";

import {
  Button,
} from "@/components/ui/Button";

import {
  Avatar,
} from "@/components/ui/Avatar";

import {
  CheckCircle2,
  FolderPlus,
  UserPlus,
} from "lucide-react";


// =====================================================
// PROPS
// =====================================================

interface ApproveCandidateModalProps {
  open: boolean;

  candidateName: string;

  /**
   * Candidate ID is passed so the parent can open
   * ProjectForm for the correct candidate.
   */
  candidateId?: string;

  loading: boolean;

  onClose: () => void;

  // Approve without assigning a project
  onApproveWithoutProject: () => void;

  /**
   * Create a new project.
   *
   * The parent component should open the SAME
   * ProjectForm.tsx used by the Projects section.
   */
  onCreateProject: (candidateId?: string) => void;

  // Select and assign an existing project
  onAssignExistingProject: () => void;
}


// =====================================================
// APPROVAL OPTION
// =====================================================

type ApprovalOption =
  | "without-project"
  | "create-project"
  | "existing-project"
  | null;


// =====================================================
// COMPONENT
// =====================================================

export function ApproveCandidateModal({
  open,
  candidateName,
  candidateId,
  loading,
  onClose,
  onApproveWithoutProject,
  onCreateProject,
  onAssignExistingProject,
}: ApproveCandidateModalProps) {

  const [
    selectedOption,
    setSelectedOption,
  ] = useState<ApprovalOption>(null);


  // ===================================================
  // RESET OPTION WHEN MODAL OPENS
  // ===================================================

  useEffect(() => {

    if (open) {
      setSelectedOption(null);
    }

  }, [open]);


  // ===================================================
  // DISPLAY NAME
  // ===================================================

  const displayName =
    candidateName?.trim() ||
    "Unknown Candidate";


  // ===================================================
  // CLOSE
  // ===================================================

  const handleClose = () => {

    if (loading) {
      return;
    }

    setSelectedOption(null);

    onClose();
  };


  // ===================================================
  // CONTINUE
  // ===================================================

  const handleContinue = () => {

    if (
      !selectedOption ||
      loading
    ) {
      return;
    }


    switch (selectedOption) {

      // ===============================================
      // APPROVE WITHOUT PROJECT
      // ===============================================

      case "without-project":

        onApproveWithoutProject();

        break;


      // ===============================================
      // CREATE NEW PROJECT
      // ===============================================

      case "create-project":

        /**
         * IMPORTANT:
         *
         * We do NOT create another project form here.
         *
         * The parent component receives the candidate ID
         * and opens the existing ProjectForm.tsx.
         */
        onCreateProject(candidateId);

        break;


      // ===============================================
      // EXISTING PROJECT
      // ===============================================

      case "existing-project":

        onAssignExistingProject();

        break;


      default:

        break;
    }
  };


  // ===================================================
  // BUTTON TEXT
  // ===================================================

  const getContinueText = () => {

    switch (selectedOption) {

      case "without-project":
        return "Approve Candidate";

      case "create-project":
        return "Create Project";

      case "existing-project":
        return "Select Project";

      default:
        return "Continue";
    }
  };


  // ===================================================
  // BUTTON ICON
  // ===================================================

  const getContinueIcon = () => {

    switch (selectedOption) {

      case "without-project":

        return (
          <CheckCircle2
            className="h-4 w-4"
          />
        );


      case "create-project":

        return (
          <FolderPlus
            className="h-4 w-4"
          />
        );


      case "existing-project":

        return (
          <UserPlus
            className="h-4 w-4"
          />
        );


      default:

        return null;
    }
  };


  // ===================================================
  // OPTION CLASS
  // ===================================================

  const getOptionClass = (
    option: Exclude<
      ApprovalOption,
      null
    >
  ) => {

    if (
      selectedOption === option
    ) {

      return `
        border-primary
        bg-primary/5
        dark:border-primary
        dark:bg-primary/10
      `;
    }


    return `
      border-slate-200
      hover:border-slate-300
      hover:bg-slate-50
      dark:border-white/10
      dark:hover:border-white/20
      dark:hover:bg-white/5
    `;
  };


  // ===================================================
  // RENDER
  // ===================================================

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Approve Candidate"
      description="Choose how you want to proceed with this candidate."
      footer={
        <>

          {/* ==========================================
              CANCEL
          =========================================== */}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>


          {/* ==========================================
              CONTINUE
          =========================================== */}

          <Button
            type="button"
            size="sm"
            onClick={handleContinue}
            loading={loading}
            disabled={
              !selectedOption ||
              loading
            }
          >

            {!loading &&
              getContinueIcon()}

            {loading
              ? "Processing..."
              : getContinueText()}

          </Button>

        </>
      }
    >

      <div className="space-y-5">

        {/* =================================================
            CANDIDATE
        ================================================= */}

        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">

          <Avatar
            name={displayName}
            size="md"
          />


          <div className="min-w-0">

            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {displayName}
            </p>


            <p className="text-xs text-slate-500 dark:text-slate-400">
              Candidate is ready to move to the next stage.
            </p>

          </div>

        </div>


        {/* =================================================
            PROJECT ASSIGNMENT
        ================================================= */}

        <div>

          <p className="mb-2 text-sm font-medium text-slate-900 dark:text-white">
            Project Assignment
          </p>


          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">

            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Choose how to handle the project.
            </p>


            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              You can approve the candidate without a
              project, create a new project, or assign
              an existing active project.
            </p>

          </div>

        </div>


        {/* =================================================
            OPTIONS
        ================================================= */}

        <div>

          <p className="mb-3 text-sm font-medium text-slate-900 dark:text-white">
            What would you like to do?
          </p>


          <div className="space-y-2">

            {/* ============================================
                OPTION 1
            ============================================= */}

            <label
              className={`
                flex cursor-pointer items-start gap-3
                rounded-lg border p-3 transition
                ${getOptionClass(
                  "without-project"
                )}
              `}
            >

              <input
                type="radio"
                name="approval-option"
                value="without-project"
                checked={
                  selectedOption ===
                  "without-project"
                }
                onChange={() =>
                  setSelectedOption(
                    "without-project"
                  )
                }
                disabled={loading}
                className="mt-1"
              />


              <div className="flex-1">

                <div className="flex items-center gap-2">

                  <CheckCircle2
                    className="h-4 w-4 text-emerald-600"
                  />

                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Approve without project
                  </p>

                </div>


                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Approve the candidate now. A project
                  can be assigned later from the candidate
                  or project management page.
                </p>

              </div>

            </label>


            {/* ============================================
                OPTION 2
            ============================================= */}

            <label
              className={`
                flex cursor-pointer items-start gap-3
                rounded-lg border p-3 transition
                ${getOptionClass(
                  "create-project"
                )}
              `}
            >

              <input
                type="radio"
                name="approval-option"
                value="create-project"
                checked={
                  selectedOption ===
                  "create-project"
                }
                onChange={() =>
                  setSelectedOption(
                    "create-project"
                  )
                }
                disabled={loading}
                className="mt-1"
              />


              <div className="flex-1">

                <div className="flex items-center gap-2">

                  <FolderPlus
                    className="h-4 w-4 text-blue-600"
                  />

                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Create a new project
                  </p>

                </div>


                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Create a project for this candidate
                  using the same project form used by
                  the Projects section.
                </p>

              </div>

            </label>


            {/* ============================================
                OPTION 3
            ============================================= */}

            <label
              className={`
                flex cursor-pointer items-start gap-3
                rounded-lg border p-3 transition
                ${getOptionClass(
                  "existing-project"
                )}
              `}
            >

              <input
                type="radio"
                name="approval-option"
                value="existing-project"
                checked={
                  selectedOption ===
                  "existing-project"
                }
                onChange={() =>
                  setSelectedOption(
                    "existing-project"
                  )
                }
                disabled={loading}
                className="mt-1"
              />


              <div className="flex-1">

                <div className="flex items-center gap-2">

                  <UserPlus
                    className="h-4 w-4 text-violet-600"
                  />

                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Assign an existing project
                  </p>

                </div>


                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Select an existing active project,
                  assign it to this candidate, and approve
                  the candidate.
                </p>

              </div>

            </label>

          </div>

        </div>


        {/* =================================================
            SELECTED ACTION INFORMATION
        ================================================= */}

        {selectedOption && (

          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 dark:border-primary/20 dark:bg-primary/10">

            <div className="flex items-start gap-2">

              {selectedOption ===
                "without-project" ? (

                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                />

              ) : selectedOption ===
                "create-project" ? (

                <FolderPlus
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                />

              ) : (

                <UserPlus
                  className="mt-0.5 h-4 w-4 shrink-0 text-violet-600"
                />

              )}


              <div>

                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">

                  {selectedOption ===
                    "without-project" &&
                    "Candidate will be approved without a project."}

                  {selectedOption ===
                    "create-project" &&
                    "The existing ProjectForm will open for this candidate."}

                  {selectedOption ===
                    "existing-project" &&
                    "You will select and assign an existing project."}

                </p>

              </div>

            </div>

          </div>

        )}

      </div>

    </Modal>
  );
}
