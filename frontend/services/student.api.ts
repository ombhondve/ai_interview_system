import api from "./api";
import type { Candidate, Interview, Slot } from "@/types";

export const studentService = {
  async me() {
    return (
      await api.get<{ candidate: Candidate }>("/student/me")
    ).data.candidate;
  },

  async invite(token: string) {
    return (
      await api.get<{
        candidate: Pick<
          Candidate,
          "id" | "name" | "email" | "phone" | "role"
        >;
      }>(
        `/student/invite?token=${encodeURIComponent(token)}`
      )
    ).data.candidate;
  },

  async slots() {
    return (
      await api.get<{ data: Slot[] }>("/student/slots")
    ).data.data;
  },

  async book(slotId: string) {
    return (
      await api.post<{ slot: Slot; interview: Interview }>(
        "/student/book",
        { slotId }
      )
    ).data;
  },

  async submitInterview(
    payload: Record<string, unknown>
  ) {
    return (
      await api.post<Interview>(
        "/student/submit-interview",
        payload
      )
    ).data;
  },

  async submitProject(url: string) {
    return (
      await api.post("/student/submit-project", {
        url,
      })
    ).data;
  },
};