import Dexie, { type Table } from 'dexie'

export interface Project {
  id: string
  name: string
  startDate: string
  endDate?: string
  createdAt: string
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
  }
}

export const db = new AppDB()
