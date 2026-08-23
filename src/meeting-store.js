import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class MeetingStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
  }

  async list() {
    const meetings = await this.readAll();
    return meetings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id) {
    const meetings = await this.readAll();
    return meetings.find((meeting) => meeting.id === id) || null;
  }

  async save(meeting) {
    const operation = this.writeQueue.then(async () => {
      const meetings = await this.readAll();
      meetings.push(meeting);
      await this.writeAll(meetings);
      return meeting;
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async readAll() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async writeAll(meetings) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(meetings, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(tempPath, this.filePath);
  }
}
