import { Slot } from "@/types";
import { request } from "@/lib/client";

export interface CreateSlotInput {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  capacity: number;
  role?: string;
}

export const slotService = {
  async getSlots(): Promise<Slot[]> {
    const result = await request<{ data: Slot[] }>(`/api/slots`);
    return result.data;
  },

  async getSlotsForDate(date: string): Promise<Slot[]> {
    const all = await slotService.getSlots();
    return all.filter((s) => s.date === date);
  },

  async createSlot(input: CreateSlotInput): Promise<Slot> {
    return request<Slot>(`/api/slots`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateSlot(id: string, input: Partial<CreateSlotInput>): Promise<Slot | null> {
    try {
      return await request<Slot>(`/api/slots/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    } catch {
      return null;
    }
  },

  async cancelSlot(id: string): Promise<Slot | null> {
    try {
      return await request<Slot>(`/api/slots/${id}`, { method: "DELETE" });
    } catch {
      return null;
    }
  },
};
