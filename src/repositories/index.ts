import { DexieProjectRepository } from '@/repositories/dexie/ProjectRepository'
import { DexieTaskRepository } from '@/repositories/dexie/TaskRepository'
import { DexieUserRepository } from '@/repositories/dexie/UserRepository'

export const projectRepository = new DexieProjectRepository()
export const taskRepository = new DexieTaskRepository()
export const userRepository = new DexieUserRepository()
