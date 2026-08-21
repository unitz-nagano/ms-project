'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, type User } from '@/lib/db'

const EMPTY_USERS: User[] = []

export function useUsers(): User[] {
  return useLiveQuery<User[], User[]>(() => db.users.toArray(), [], EMPTY_USERS)
}
