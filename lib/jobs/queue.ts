export interface JobStatus {
  id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  elapsedTime: string;
  estimatedRemaining: string;
  fileSize: string;
  outputSize?: string;
  error?: string;
  outputFormat?: string;
  outputResolution?: string;
}

export interface JobQueue {
  jobs: Map<string, JobStatus>;
  addJob: (filename: string) => string;
  updateJob: (jobId: string, updates: Partial<JobStatus>) => void;
  removeJob: (jobId: string) => void;
  getJob: (jobId: string) => JobStatus | undefined;
  cancelJob: (jobId: string) => boolean;
}

export class SimpleJobQueue implements JobQueue {
  jobs: Map<string, JobStatus> = new Map();

  addJob(filename: string): string {
    const jobId = uuidv4();
    const now = new Date();
    const job: JobStatus = {
      id: jobId,
      filename,
      status: "pending",
      progress: 0,
      elapsedTime: "0:00",
      estimatedRemaining: "0:00",
      fileSize: "0 B",
    };

    this.jobs.set(jobId, job);
    return jobId;
  }

  updateJob(jobId: string, updates: Partial<JobStatus>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const updated = {
      ...job,
      ...updates,
      progress: Math.max(0, Math.min(100, (job.progress || 0) + (updates.progress || 0))),
      elapsedTime: updates.elapsedTime || job.elapsedTime,
      estimatedRemaining: updates.estimatedRemaining || job.estimatedRemaining,
    };

    this.jobs.set(jobId, updated);
  }

  removeJob(jobId: string): void {
    this.jobs.delete(jobId);
  }

  getJob(jobId: string): JobStatus | undefined {
    return this.jobs.get(jobId);
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.status = "cancelled";
    job.progress = 100;
    this.jobs.set(jobId, job);
    return true;
  }
}

/** UUID helper */
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}