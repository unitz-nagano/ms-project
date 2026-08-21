import { nanoid } from 'nanoid'
import { db } from '@/lib/db'
import type { User } from '@/lib/db'
import type { UserRepository, CreateUserInput, UpdateUserInput } from '@/repositories/types'

const PRESET_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

export class DexieUserRepository implements UserRepository {
  async findAll(): Promise<User[]> {
    return db.users.toArray()
  }

  async findById(id: string): Promise<User | null> {
    return (await db.users.get(id)) ?? null
  }

  async create(input: CreateUserInput): Promise<User> {
    const count = await db.users.count()
    const color = input.color || PRESET_COLORS[count % PRESET_COLORS.length]
    const user: User = { ...input, id: nanoid(), color }
    await db.users.add(user)
    return user
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    await db.users.update(id, input)
    const updated = await db.users.get(id)
    if (!updated) throw new Error(`User ${id} not found`)
    return updated
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.users, db.tasks, async () => {
      await db.users.delete(id)
      const assignedTasks = await db.tasks.where('assigneeId').equals(id).toArray()
      await Promise.all(assignedTasks.map((task) => db.tasks.update(task.id, { assigneeId: undefined })))
    })
  }
}
