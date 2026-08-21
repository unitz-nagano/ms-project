'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { buildOrderedTasks } from '@/lib/task-tree'

const EMPTY_TASK_DATA = {
  orderedTasks: [],
  visibleTasks: [],
}

export function useTasks(projectId: string) {
  return useLiveQuery(async () => {
    const tasks = await db.tasks.where('projectId').equals(projectId).sortBy('order')
    return buildOrderedTasks(tasks)
  }, [projectId], EMPTY_TASK_DATA)
}
