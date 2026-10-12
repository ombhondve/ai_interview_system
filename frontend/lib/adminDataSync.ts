/**
 * Centralized data synchronization bus for RecruitAI Admin Panel.
 *
 * Allows components (Dashboard, Candidates, Projects, Schedule, Interviews,
 * Header, Settings) to publish and subscribe to data mutation events silently,
 * updating the UI in the background without full-page reload.
 */

export type SyncEventTopic =
  | "candidate:updated"
  | "candidate:approved"
  | "candidate:rejected"
  | "admin:candidate:updated"
  | "project:created"
  | "project:assigned"
  | "project:verified"
  | "admin:project:updated"
  | "interview:booked"
  | "interview:updated"
  | "admin:interview:updated"
  | "schedule:updated"
  | "admin:profile:updated"
  | "notifications:updated";

export function publishAdminSync(topic: SyncEventTopic, data?: unknown): void {
  if (typeof window === "undefined") return;

  const event = new CustomEvent(`recruitai:${topic}`, {
    detail: data,
    bubbles: true,
  });
  window.dispatchEvent(event);

  // Also dispatch a general sync event for aggregate listeners like dashboard
  window.dispatchEvent(
    new CustomEvent("recruitai:data:mutated", {
      detail: { topic, data },
      bubbles: true,
    })
  );
}

export function subscribeAdminSync(
  topic: SyncEventTopic | "data:mutated",
  callback: (data?: unknown) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const eventName = `recruitai:${topic}`;
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  };

  window.addEventListener(eventName, handler);
  return () => {
    window.removeEventListener(eventName, handler);
  };
}
