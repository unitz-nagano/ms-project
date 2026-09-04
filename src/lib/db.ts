import Dexie, { type Table } from 'dexie'
import { parseISO } from 'date-fns'
import { countWorkdays, DEFAULT_CALENDAR, durationToWork } from '@/lib/scheduling'

export interface Project {
  id: string
  name: string
  startDate: string
  endDate?: string
  createdAt: string
  /** 1日あたりの稼働時間（人時）。工数(work)算出に使う */
  hoursPerDay: number
  /** 非稼働の曜日（0=日〜6=土） */
  nonWorkingWeekdays: number[]
  /** 個別の非稼働日（祝日・会社休日など）のISO日付オーバーライド */
  nonWorkingDates: string[]
}

export interface Task {
  id: string
  projectId: string
  parentId?: string
  name: string
  startDate: string
  endDate: string
  progress: number
  isMilestone: boolean
  order: number
  assigneeId?: string
  isExpanded: boolean
  /** 期間（稼働日数） */
  duration: number
  /** 工数（人時） */
  work: number
  /** true: 手動スケジュール（日付固定）, false: 自動スケジュール（依存関係+カレンダーから計算） */
  isManual: boolean
}

export interface Dependency {
  id: string
  predecessorId: string
  successorId: string
  type: 'FS'
  lag: number
}

export interface User {
  id: string
  name: string
  color: string
}

export class AppDB extends Dexie {
  projects!: Table<Project>
  tasks!: Table<Task>
  dependencies!: Table<Dependency>
  users!: Table<User>

  constructor() {
    super('gantt-app')
    this.version(1).stores({
      projects: 'id, createdAt',
      tasks: 'id, projectId, parentId, order',
      dependencies: 'id, predecessorId, successorId',
      users: 'id',
    })
    this.version(2)
      .stores({
        projects: 'id, createdAt',
        tasks: 'id, projectId, parentId, order',
        dependencies: 'id, predecessorId, successorId',
        users: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('projects')
          .toCollection()
          .modify((project: Project) => {
            project.hoursPerDay = DEFAULT_CALENDAR.hoursPerDay
            project.nonWorkingWeekdays = DEFAULT_CALENDAR.nonWorkingWeekdays
            project.nonWorkingDates = DEFAULT_CALENDAR.nonWorkingDates
          })
        await tx
          .table('tasks')
          .toCollection()
          .modify((task: Task) => {
            const duration = task.startDate === task.endDate
              ? 0
              : countWorkdays(parseISO(task.startDate), parseISO(task.endDate), DEFAULT_CALENDAR)
            task.duration = duration
            task.work = durationToWork(duration, DEFAULT_CALENDAR.hoursPerDay)
            // 既存の日付をそのまま尊重し、自動計算で勝手にズレないようにする
            task.isManual = true
          })
      })
  }
}

export const db = new AppDB()
