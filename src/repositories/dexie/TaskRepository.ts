import { nanoid } from 'nanoid'
import { db } from '@/lib/db'
import type { Task } from '@/lib/db'
import { getDescendantTaskIds } from '@/lib/task-tree'
import type { TaskRepository, CreateTaskInput, UpdateTaskInput } from '@/repositories/types'

export class DexieTaskRepository implements TaskRepository {
  async findAll(projectId: string): Promise<Task[]> {
    return db.tasks.where('projectId').equals(projectId).sortBy('order')
  }

  async findById(id: string): Promise<Task | null> {
    return (await db.tasks.get(id)) ?? null
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const task: Task = { ...input, id: nanoid() }
    await db.tasks.add(task)
    return task
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    await db.tasks.update(id, input)
    const updated = await db.tasks.get(id)
    if (!updated) throw new Error(`Task ${id} not found`)
    return updated
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.tasks, db.dependencies, async () => {
      const tasks = await db.tasks.toArray()
      const descendantIds = getDescendantTaskIds(tasks, id)
      const targetIds = [id, ...descendantIds]

      await db.dependencies.where('predecessorId').anyOf(targetIds).or('successorId').anyOf(targetIds).delete()
      await db.tasks.bulkDelete(targetIds)
    })
  }
}
