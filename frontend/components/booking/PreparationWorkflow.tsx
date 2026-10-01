"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { enhancedBookingService, InterviewBooking, PreparationStep } from "@/services/enhancedBooking.api";
import { bookingHelpers } from "@/services/enhancedBooking.api";

interface PreparationWorkflowProps {
  candidateId: string;
  interviewId: string;
  onPreparationComplete?: () => void;
  onReadyToConfirm?: () => void;
}

export function PreparationWorkflow({
  candidateId,
  interviewId,
  onPreparationComplete,
  onReadyToConfirm,
}: PreparationWorkflowProps) {
  const [interview, setInterview] = useState<InterviewBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [steps, setSteps] = useState<PreparationStep[]>([]);
  const [completionPercentage, setCompletionPercentage] = useState(0);

  const loadInterviewStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      
      const status = await enhancedBookingService.getInterviewStatus(interviewId, candidateId);
      
      if (status.success) {
        setInterview(status.interview);
        setCompletionPercentage(status.preparation.progress);
        
        // Generate steps based on requirements
        const generatedSteps: PreparationStep[] = [];
        
        // Profile completion step
        if (status.interview.slot?.requirements?.completedProfile) {
          generatedSteps.push({
            id: "complete_profile",
            title: "Complete Your Profile",
            description: "Ensure all profile information is up to date",
            required: true,
          });
        }
        
        // Documents step
        if (status.interview.slot?.requirements?.requiredDocuments?.length) {
          generatedSteps.push({
            id: "upload_documents",
            title: "Upload Required Documents",
            description: `Upload ${status.interview.slot.requirements.requiredDocuments.join(", ")}`,
            required: true,
          });
        }
        
        // Test step (always required)
        generatedSteps.push({
          id: "take_preparation_test",
          title: "Take Preparation Test",
          description: "Complete a short test to assess readiness",
          required: true,
        });
        
        // Review materials step (optional)
        generatedSteps.push({
          id: "review_materials",
          title: "Review Interview Materials",
          description: "Go through interview guidelines and tips",
          required: false,
        });
        
        setSteps(generatedSteps);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preparation status");
    } finally {
      setLoading(false);
    }
  }, [interviewId, candidateId]);

  useEffect(() => {
    loadInterviewStatus();
  }, [interviewId, candidateId, loadInterviewStatus]);

  const handleStartPreparation = async () => {
    try {
      setUpdating(true);
      const result = await enhancedBookingService.startPreparation(interviewId, candidateId);
      
      if (result.success) {
        setInterview(result.interview);
        setSteps(result.nextSteps);
        
        if (onPreparationComplete) {
          onPreparationComplete();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start preparation");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePreparation = async (stepId: string, completed: boolean) => {
    try {
      setUpdating(true);
      
      const updateData: any = {};
      
      switch (stepId) {
        case "complete_profile":
          updateData.profileComplete = completed;
          break;
        case "upload_documents":
          // In a real app, this would handle file uploads
          updateData.documentsSubmitted = completed ? ["resume.pdf", "id.jpg"] : [];
          break;
        case "take_preparation_test":
          updateData.testCompleted = completed;
          if (completed) {
            updateData.readinessScore = 85; // Simulated score
          }
          break;
        case "review_materials":
          updateData.notes = completed ? "Materials reviewed" : undefined;
          break;
      }
      
      const result = await enhancedBookingService.updatePreparation(
        interviewId,
        candidateId,
        updateData
      );
      
      if (result.success) {
        setInterview(result.interview);
        setCompletionPercentage(result.completionPercentage);
        
        if (result.preparationComplete && onReadyToConfirm) {
          onReadyToConfirm();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update preparation");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmReadiness = async () => {
    try {
      setUpdating(true);
      const result = await enhancedBookingService.confirmReadiness(interviewId, candidateId);
      
      if (result.success && onReadyToConfirm) {
        onReadyToConfirm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm readiness");
    } finally {
      setUpdating(false);
    }
  };

  const getStepStatus = (stepId: string): "pending" | "in_progress" | "completed" => {
    if (!interview) return "pending";
    
    const prepStatus = interview.preparationStatus;
    
    switch (stepId) {
      case "complete_profile":
        return prepStatus.profileComplete ? "completed" : "pending";
      case "upload_documents":
        return prepStatus.documentsSubmitted && prepStatus.documentsSubmitted.length > 0 ? "completed" : "pending";
      case "take_preparation_test":
        return prepStatus.testCompleted ? "completed" : "pending";
      case "review_materials":
        return prepStatus.preparationNotes ? "completed" : "pending";
      default:
        return "pending";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            <p className="font-medium text-slate-900">Loading preparation status</p>
            <p className="mt-1 text-sm text-slate-500">Checking your interview preparation progress...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="font-medium text-red-600">Error loading preparation</p>
            <p className="mt-1 text-sm text-red-500">{error}</p>
            <Button className="mt-4" size="sm" onClick={loadInterviewStatus}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!interview) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-slate-500">No interview found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if preparation hasn't started yet
  if (interview.status === "scheduled" && !interview.preparationStatus?.lastPreparationCheck) {
    return (
      <Card>
        <CardHeader
          title="Start Your Interview Preparation"
          subtitle="Complete the preparation steps to get ready for your interview"
        />
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Ready to start preparation?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Begin your interview preparation to ensure you&apos;re fully ready. This includes profile completion, 
              document upload, and a preparation test.
            </p>
            
            <div className="mt-6">
              <Button
                size="lg"
                onClick={handleStartPreparation}
                loading={updating}
                disabled={updating}
              >
                Start Preparation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Interview Preparation"
        subtitle="Complete these steps to get ready for your interview"
      />
      
      <CardContent className="space-y-6">
        {/* Progress overview */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Preparation Progress</p>
              <p className="text-sm text-slate-500">{completionPercentage}% complete</p>
            </div>
            <Badge variant={completionPercentage === 100 ? "success" : "neutral"}>
              {completionPercentage === 100 ? "Ready to confirm" : "In progress"}
            </Badge>
          </div>
          
          <ProgressBar value={completionPercentage} />
        </div>

        {/* Readiness score */}
        {interview.preparationStatus.readinessScore > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Readiness Score</p>
                <p className="text-2xl font-bold text-slate-900">
                  {interview.preparationStatus.readinessScore}%
                </p>
                <p className="text-sm text-slate-500">
                  Based on your preparation test and profile completeness
                </p>
              </div>
              <div className="rounded-full bg-blue-100 p-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Preparation steps */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-900">Preparation Steps</h3>
          
          {steps.map((step) => {
            const status = getStepStatus(step.id);
            const isCompleted = status === "completed";
            
            return (
              <div
                key={step.id}
                className={`rounded-lg border p-4 ${
                  isCompleted
                    ? "border-green-200 bg-green-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      isCompleted
                        ? "bg-green-100 text-green-600"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {isCompleted ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-xs font-medium">{step.required ? "!" : "○"}</span>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-slate-900">{step.title}</h4>
                      <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                      
                      {step.required && (
                        <span className="mt-2 inline-block rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          Required
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    {isCompleted ? (
                      <Badge variant="success">Completed</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdatePreparation(step.id, true)}
                        disabled={updating}
                        loading={updating}
                      >
                        Mark Complete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Next actions */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-medium text-slate-900">Next Steps</h3>
          
          {completionPercentage === 100 ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-slate-600">
                Your preparation is complete! You can now confirm your readiness for the interview.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmReadiness}
                  loading={updating}
                  disabled={updating}
                >
                  Confirm Readiness
                </Button>
                <Button variant="outline" onClick={loadInterviewStatus}>
                  Refresh Status
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-slate-600">
                Complete all required steps above to confirm your readiness for the interview.
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Interview scheduled for {bookingHelpers.formatDateTime(interview.slot?.startTime || "")}</span>
              </div>
            </div>
          )}
        </div>

        {/* Requirements reminder */}
        {interview.slot?.requirements && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-medium text-blue-900">Required for Interview</h3>
            <ul className="mt-2 space-y-1 text-sm text-blue-700">
              {interview.slot.requirements.requiredDocuments?.map((doc, index) => (
                <li key={index} className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{doc}</span>
                </li>
              ))}
              {interview.slot.requirements.completedProfile && (
                <li className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Complete candidate profile</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}