'use client'

import { useMemo, useState } from 'react'
import { Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { UserBadge } from '@/components/users/UserBadge'
import { useUsers } from '@/hooks/useUsers'
import { userRepository } from '@/repositories'
import type { Task, User } from '@/lib/db'

interface UserManagerDialogProps {
  open: boolean
  onClose: () => void
  tasks?: Task[]
}

export function UserManagerDialog({ open, onClose, tasks = [] }: UserManagerDialogProps) {
  const users = useUsers()
  const [name, setName] = useState('')
  const assigneeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) {
      if (!task.assigneeId) continue
      counts.set(task.assigneeId, (counts.get(task.assigneeId) ?? 0) + 1)
    }
    return counts
  }, [tasks])

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    await userRepository.create({ name: trimmedName, color: '' })
    setName('')
  }

  const handleDelete = async (user: User) => {
    const taskCount = assigneeCounts.get(user.id) ?? 0
    const confirmed = window.confirm(
      taskCount > 0
        ? `${user.name} を削除すると ${taskCount} 件のタスク担当が未設定になります。削除しますか？`
        : `${user.name} を削除しますか？`,
    )

    if (!confirmed) return
    await userRepository.delete(user.id)
  }

  return (
    <Dialog open={open} onClose={onClose} title="担当者管理">
      <div className="space-y-5">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-700">
            <Users className="h-4 w-4" />
            担当者を追加
          </div>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例: 佐藤 花子"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleCreate()
                }
              }}
            />
            <Button onClick={() => void handleCreate()}>追加</Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-700">登録済み担当者</h3>
          {users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
              まだ担当者が登録されていません。
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
                  <div className="space-y-1">
                    <UserBadge name={user.name} color={user.color} />
                    <p className="text-xs text-zinc-500">担当中タスク: {assigneeCounts.get(user.id) ?? 0}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                    onClick={() => void handleDelete(user)}
                    aria-label={`${user.name} を削除`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
