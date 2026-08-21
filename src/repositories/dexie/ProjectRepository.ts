import { nanoid } from 'nanoid'
import { db } from '@/lib/db'
import type { Project } from '@/lib/db'
import type { ProjectRepository, CreateProjectInput, UpdateProjectInput } from '@/repositories/types'

export class DexieProjectRepository implements ProjectRepository {
  async findAll(): Promise<Project[]> {
    return db.projects.orderBy('createdAt').toArray()
  }

  async findById(id: string): Promise<Project | null> {
    return (await db.projects.get(id)) ?? null
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const project: Project = {
      ...input,
      id: nanoid(),
      createdAt: new Date().toISOString(),
    }
    await db.projects.add(project)
    return project
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    await db.projects.update(id, input)
    const updated = await db.projects.get(id)
    if (!updated) throw new Error(`Project ${id} not found`)
    return updated
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.projects, db.tasks, db.dependencies, async () => {
      const tasks = await db.tasks.where('projectId').equals(id).toArray()
      const taskIds = tasks.map((t) => t.id)
      await db.dependencies
        .where('predecessorId').anyOf(taskIds)
        .or('successorId').anyOf(taskIds)
        .delete()
      await db.tasks.where('projectId').equals(id).delete()
      await db.projects.delete(id)
    })
  }
}
