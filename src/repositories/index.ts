import { DexieProjectRepository } from '@/repositories/dexie/ProjectRepository'
import { DexieTaskRepository } from '@/repositories/dexie/TaskRepository'
import { DexieUserRepository } from '@/repositories/dexie/UserRepository'
import { DexieDependencyRepository } from '@/repositories/dexie/DependencyRepository'

export const projectRepository = new DexieProjectRepository()
export const taskRepository = new DexieTaskRepository()
export const userRepository = new DexieUserRepository()
export const dependencyRepository = new DexieDependencyRepository()
