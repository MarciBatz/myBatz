import { prisma } from './prisma'
import type { PrivateTaskColumnValue } from './private-tasks'

/** Records a task's creation in its history, with the column it started in. */
export async function logTaskCreated(privateTaskId: string, toColumn: PrivateTaskColumnValue) {
  await prisma.privateTaskEvent.create({
    data: { privateTaskId, type: 'created', toColumn },
  })
}

/**
 * Records a column move and, when the destination is Kész, stamps doneAt so the
 * archive can sort by when the task was completed. doneAt is only ever set
 * (never cleared) — moving back out of Kész leaves the last-completed time,
 * which is fine since only archived (Kész) tasks are read from it.
 */
export async function logTaskMoved(privateTaskId: string, fromColumn: PrivateTaskColumnValue, toColumn: PrivateTaskColumnValue) {
  await prisma.privateTaskEvent.create({
    data: { privateTaskId, type: 'moved', fromColumn, toColumn },
  })
  if (toColumn === 'DONE') {
    await prisma.privateTask.update({ where: { id: privateTaskId }, data: { doneAt: new Date() } })
  }
}
