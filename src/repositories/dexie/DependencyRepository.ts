import { nanoid } from 'nanoid'
import { db, type Dependency } from '@/lib/db'
import type { DependencyRepository, CreateDependencyInput } from '@/repositories/types'

export class DexieDependencyRepository implements DependencyRepository {
  async findByProject(_projectId: string, tasks: { id: string }[]): Promise<Dependency[]> {
    const ids = new Set(tasks.map((t) => t.id))
    const all = await db.dependencies.toArray()
    return all.filter((d) => ids.has(d.predecessorId) && ids.has(d.successorId))
  }

  async create(input: CreateDependencyInput): Promise<Dependency> {
    const dep: Dependency = { ...input, id: nanoid() }
    await db.dependencies.add(dep)
    return dep
  }

  async delete(id: string): Promise<void> {
    await db.dependencies.delete(id)
  }
}
