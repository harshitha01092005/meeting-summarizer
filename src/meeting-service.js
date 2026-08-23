import { randomUUID } from "node:crypto";

export class MeetingService {
  constructor({ aiClient, store, clock = () => new Date() }) {
    this.aiClient = aiClient;
    this.store = store;
    this.clock = clock;
  }

  async process({ audio, title, context }) {
    const startedAt = Date.now();
    const transcript = await this.aiClient.transcribe({
      buffer: Buffer.from(await audio.arrayBuffer()),
      filename: audio.name,
      mimeType: audio.type,
      context,
    });
    const summary = await this.aiClient.summarize({
      transcript,
      meetingTitle: title,
    });

    const meeting = {
      id: randomUUID(),
      createdAt: this.clock().toISOString(),
      source: {
        filename: audio.name,
        mimeType: audio.type || "application/octet-stream",
        sizeBytes: audio.size,
      },
      title: title || summary.title,
      transcript,
      summary: {
        ...summary,
        title: title || summary.title,
      },
      processingTimeMs: Date.now() - startedAt,
    };

    return this.store.save(meeting);
  }
}
