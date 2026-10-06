import type { CronTask } from 'deepspace/worker'

// No scheduled tasks yet; the Worker retains the SDK's CronRoom binding.
export const tasks: CronTask[] = []
export async function runTask(_name: string, _env: unknown): Promise<void> {}
