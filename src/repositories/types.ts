import type { Project, Task, Dependency, User } from '@/lib/db'

export type CreateProjectInput = Omit<Project, 'id' | 'createdAt'>
export type UpdateProjectInput = Partial<Omit<Project, 'id' | 'createdAt'>>

export type CreateTaskInput = Omit<Task, 'id'>
export type UpdateTaskInput = Partial<Omit<Task, 'id'>>

export type CreateDependencyInput = Omit<Dependency, 'id'>

export type CreateUserInput = Omit<User, 'id'>
export type UpdateUserInput = Partial<Omit<User, 'id'>>

export interface ProjectRepository {
  findAll(): Promise<Project[]>
  findById(id: string): Promise<Project | null>
  create(input: CreateProjectInput): Promise<Project>
  update(id: string, input: UpdateProjectInput): Promise<Project>
  delete(id: string): Promise<void>
}

export interface TaskRepository {
  findAll(projectId: string): Promise<Task[]>
  findById(id: string): Promise<Task | null>
  create(input: CreateTaskInput): Promise<Task>
  update(id: string, input: UpdateTaskInput): Promise<Task>
  delete(id: string): Promise<void>
}

export interface DependencyRepository {
  findByProject(projectId: string, tasks: Task[]): Promise<Dependency[]>
  create(input: CreateDependencyInput): Promise<Dependency>
  delete(id: string): Promise<void>
}

export interface UserRepository {
  findAll(): Promise<User[]>
  findById(id: string): Promise<User | null>
  create(input: CreateUserInput): Promise<User>
  update(id: string, input: UpdateUserInput): Promise<User>
  delete(id: string): Promise<void>
}
