"use client";

import ProjectAIGeneratorModal, {
  type ProjectAIGeneratorData,
} from "@/components/projects/ProjectAIGeneratorModal";

import type { ProjectFormData } from "@/components/projects/ProjectForm";
import type { Candidate } from "@/types";

/* =========================================================
   TYPES
========================================================= */

export interface StudentProjectGeneratorModalProps {
  /**
   * Controls whether the modal is visible.
   */
  open: boolean;

  /**
   * Student for whom the project should be generated.
   */
  student: Candidate | null;

  /**
   * Close the modal.
   */
  onClose: () => void;

  /**
   * Optional back action.
   *
   * Useful when this modal is opened from another
   * project-generation flow.
   */
  onBack?: () => void;

  /**
   * Called when the admin clicks "Generate Project".
   *
   * The parent should call the backend API here.
   */
  onGenerate?: (
    data: ProjectAIGeneratorData
  ) => void | Promise<void>;

  /**
   * Optional callback after a project has been generated.
   */
  onGenerated?: (
    project: ProjectFormData
  ) => void;

  /**
   * Preserve previously entered generator values.
   *
   * This is useful when the admin goes from:
   *
   * Generator → Preview → Edit → Generator
   */
  initialData?: Partial<ProjectAIGeneratorData>;

  /**
   * Shows loading state while the backend is generating
   * the project and/or PDF.
   */
  loading?: boolean;
}

/* =========================================================
   COMPONENT
========================================================= */

/**
 * StudentProjectGeneratorModal
 *
 * Student-specific project generator.
 *
 * This component intentionally reuses ProjectAIGeneratorModal
 * instead of duplicating the complete AI generation form.
 *
 * Advantages:
 * - One source of truth for AI generation
 * - Same validation
 * - Same technology selection
 * - Same project focus selection
 * - Same PDF generation option
 * - Student information is automatically passed
 * - Easier maintenance
 */
export default function StudentProjectGeneratorModal({
  open,
  student,
  onClose,
  onBack,
  onGenerate,
  onGenerated,
  initialData,
  loading = false,
}: StudentProjectGeneratorModalProps) {
  /* =======================================================
     STUDENT VALIDATION
  ======================================================= */

  /**
   * Do not render the generator when there is no student.
   *
   * This prevents accidentally generating a student-specific
   * project without knowing which student it belongs to.
   */
  if (!student) {
    return null;
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <ProjectAIGeneratorModal
      open={open}
      onClose={onClose}
      onBack={onBack}
      student={student}
      mode="student"
      onGenerate={onGenerate}
      onGenerated={onGenerated}
      initialData={initialData}
      loading={loading}
    />
  );
}