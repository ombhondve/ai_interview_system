/** Provider contract for meeting integrations. */
export class MeetingProvider {
  async createMeeting() { throw new Error("createMeeting is not implemented"); }
  async getMeeting() { throw new Error("getMeeting is not implemented"); }
  async startAgent() { throw new Error("This meeting provider does not support an AI media agent"); }
  async stopAgent() { throw new Error("This meeting provider does not support an AI media agent"); }
  async getTranscript() { throw new Error("This meeting provider does not expose a transcript API"); }
}
export default MeetingProvider;
