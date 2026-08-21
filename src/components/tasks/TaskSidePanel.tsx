'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store/useAppStore'
import { taskRepository, dependencyRepository } from '@/repositories'
import { db, type Task, type User } from '@/lib/db'
import { getDescendantTaskIds, hasCycle } from '@/lib/task-tree'

interface TaskSidePanelProps {
  tasks: Task[]
  users: User[]
}

interface TaskFormState {
  name: string
  startDate: string
  endDate: string
  progress: string
  assigneeId: string
  isMilestone: boolean
}

function createFormState(task: Task): TaskFormState {
  return {
    name: task.name,
    startDate: task.startDate,
    endDate: task.endDate,
    progress: String(task.progress),
    assigneeId: task.assigneeId ?? '',
    isMilestone: task.isMilestone,
  }
}

function TaskSidePanelContent({ task, tasks, users, onClose }: { task: Task; tasks: Task[]; users: User[]; onClose: () => void }) {
  const [formState, setFormState] = useState<TaskFormState>(() => createFormState(task))
  const deps = useLiveQuery(
    () => db.dependencies.where('successorId').equals(task.id).toArray(),
    [task.id],
    [],
  )

  const handleAddDep = async (predecessorId: string) => {
    if (!predecessorId) return
    if (deps.some((d) => d.predecessorId === predecessorId)) return
    if (hasCycle(deps, predecessorId, task.id)) {
      alert('循環依存が発生するため追加できません')
      return
    }
    await dependencyRepository.create({ predecessorId, successorId: task.id, type: 'FS', lag: 0 })
  }

  const handleSave = async () => {
    await taskRepository.update(task.id, {
      name: formState.name.trim() || task.name,
      startDate: formState.startDate,
      endDate: formState.endDate,
      progress: Math.min(100, Math.max(0, Number(formState.progress) || 0)),
      assigneeId: formState.assigneeId || undefined,
      isMilestone: formState.isMilestone,
    })
  }

  const handleDelete = async () => {
    const descendants = getDescendantTaskIds(tasks, task.id)
    const message =
      descendants.length > 0
        ? `${task.name} と ${descendants.length} 件の子タスクを削除します。よろしいですか？`
        : `${task.name} を削除しますか？`

    if (!window.confirm(message)) return

    await taskRepository.delete(task.id)
    onClose()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <div>
          <p className="text-sm text-zinc-500">タスク詳細</p>
          <h2 className="text-lg font-semibold text-zinc-900">{task.name}</h2>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          onClick={onClose}
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">タスク名</span>
          <Input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">開始日</span>
            <Input
              type="date"
              value={formState.startDate}
              onChange={(event) => setFormState((current) => ({ ...current, startDate: event.target.value }))}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">終了日</span>
            <Input
              type="date"
              value={formState.endDate}
              onChange={(event) => setFormState((current) => ({ ...current, endDate: event.target.value }))}
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">進捗 (%)</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={formState.progress}
            onChange={(event) => setFormState((current) => ({ ...current, progress: event.target.value }))}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">担当者</span>
          <select
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value={formState.assigneeId}
            onChange={(event) => setFormState((current) => ({ ...current, assigneeId: event.target.value }))}
          >
            <option value="">未設定</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3">
          <input
            type="checkbox"
            checked={formState.isMilestone}
            onChange={(event) => setFormState((current) => ({ ...current, isMilestone: event.target.checked }))}
          />
          <span className="text-sm font-medium text-zinc-700">マイルストーン</span>
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium text-zinc-700">先行タスク（FS）</span>
          {deps.length > 0 && (
            <ul className="space-y-1">
              {deps.map((dep) => {
                const pred = tasks.find((t) => t.id === dep.predecessorId)
                return (
                  <li key={dep.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                    <span className="truncate text-zinc-700">{pred?.name ?? '不明'}</span>
                    <button
                      type="button"
                      className="ml-2 shrink-0 text-zinc-400 hover:text-red-500"
                      onClick={() => void dependencyRepository.delete(dep.id)}
                      aria-label="依存を削除"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <select
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value=""
            onChange={(e) => void handleAddDep(e.target.value)}
          >
            <option value="">先行タスクを追加...</option>
            {tasks
              .filter((t) => t.id !== task.id && !deps.some((d) => d.predecessorId === t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          onClick={() => void handleDelete()}
        >
          <Trash2 className="h-4 w-4" />
          削除
        </button>
        <div className="flex gap-2">
          <Button className="bg-zinc-200 text-zinc-900 hover:bg-zinc-300" onClick={onClose}>
            閉じる
          </Button>
          <Button onClick={() => void handleSave()}>保存</Button>
        </div>
      </div>
    </div>
  )
}

export function TaskSidePanel({ tasks, users }: TaskSidePanelProps) {
  const { selectedTaskId, isSidePanelOpen, closeSidePanel, panelWidth } = useAppStore()
  const task = useMemo(
    () => tasks.find((candidate) => candidate.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  )

  return (
    <AnimatePresence>
      {isSidePanelOpen && task ? (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-y-0 right-0 z-50 border-l border-zinc-200 bg-white shadow-2xl"
          style={{ width: panelWidth }}
        >
          <TaskSidePanelContent key={task.id} task={task} tasks={tasks} users={users} onClose={closeSidePanel} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
