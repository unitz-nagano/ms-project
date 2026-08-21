'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Project } from '@/lib/db'

const EMPTY_PROJECTS: Project[] = []

export function useProjects(): Project[] {
  return useLiveQuery<Project[], Project[]>(() => db.projects.orderBy('createdAt').reverse().toArray(), [], EMPTY_PROJECTS)
}
