'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Dependency } from '@/lib/db'
import { buildOrderedTasks } from '@/lib/task-tree'
import { calendarFromProject, computeAutomaticDates, DEFAULT_CALENDAR } from '@/lib/scheduling'
import { dependencyRepository } from '@/repositories'

const EMPTY_TASK_DATA = {
  orderedTasks: [],
  visibleTasks: [],
  dependencies: [] as Dependency[],
}

export function useTasks(projectId: string) {
  return useLiveQuery(
    async () => {
      const [tasks, project] = await Promise.all([
        db.tasks.where('projectId').equals(projectId).sortBy('order'),
        db.projects.get(projectId),
      ])
      const dependencies = await dependencyRepository.findByProject(projectId, tasks)
      const calendar = project ? calendarFromProject(project) : DEFAULT_CALENDAR
      const computed = computeAutomaticDates(tasks, dependencies, calendar)

      const effectiveTasks = tasks.map((task) => {
        const override = computed.get(task.id)
        return override ? { ...task, ...override } : task
      })

      return { ...buildOrderedTasks(effectiveTasks), dependencies }
    },
    [projectId],
    EMPTY_TASK_DATA,
  )
}
