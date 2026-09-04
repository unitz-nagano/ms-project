'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store/useAppStore'
import { taskRepository, dependencyRepository } from '@/repositories'
import { db, type Task, type User } from '@/lib/db'
import { getDescendantTaskIds, hasCycle } from '@/lib/task-tree'
import { addWorkdays, countWorkdays, durationToWork, nextWorkingDay, workToDuration, type CalendarConfig } from '@/lib/scheduling'

interface TaskSidePanelProps {
  tasks: Task[]
  users: User[]
  calendar: CalendarConfig
}

interface TaskFormState {
  name: string
  startDate: string
  endDate: string
  progress: string
  assigneeId: string
  duration: string
  work: string
  isManual: boolean
}

function createFormState(task: Task): TaskFormState {
  return {
    name: task.name,
    startDate: task.startDate,
    endDate: task.endDate,
    progress: String(task.progress),
    assigneeId: task.assigneeId ?? '',
    duration: String(task.duration),
    work: String(task.work),
    isManual: task.isManual,
  }
}

function TaskSidePanelContent({
  task,
  tasks,
  users,
  calendar,
  onClose,
}: {
  task: Task
  tasks: Task[]
  users: User[]
  calendar: CalendarConfig
  onClose: () => void
}) {
  const [formState, setFormState] = useState<TaskFormState>(() => createFormState(task))
  const hasChildren = useMemo(() => tasks.some((t) => t.parentId === task.id), [tasks, task.id])
  // startDate === endDate なら自動マイルストーン（task-tree.ts と同じ判定）
  const isMilestone = task.isMilestone || task.startDate === task.endDate
  const deps = useLiveQuery(
    () => db.dependencies.where('successorId').equals(task.id).toArray(),
    [task.id],
    [],
  )
  const hasPredecessors = deps.length > 0
  // 自動(依存あり)は開始日・終了日とも計算値でロック。自動(依存なし)は開始日のみ手入力の起点。手動は両方editable
  const startDateEditable = !hasChildren && (formState.isManual || !hasPredecessors)
  const endDateEditable = !hasChildren && formState.isManual
  // Duration/Work は「自動スケジュール」タスクのみ直接編集可（手動タスクは日付が正なので逆算表示のみ）。
  // duration=0 の入力自体がマイルストーンを表すので、isMilestone ではロックしない
  const durationEditable = !hasChildren && !formState.isManual
  const displayDuration = hasChildren
    ? task.startDate === task.endDate
      ? 0
      : countWorkdays(parseISO(task.startDate), parseISO(task.endDate), calendar)
    : durationEditable
      ? Number(formState.duration) || 0
      : formState.startDate === formState.endDate
        ? 0
        : countWorkdays(parseISO(formState.startDate), parseISO(formState.endDate), calendar)
  const displayWork = durationEditable ? Number(formState.work) || 0 : durationToWork(displayDuration, calendar.hoursPerDay)

  const handleAddDep = async (predecessorId: string) => {
    if (!predecessorId) return
    if (deps.some((d) => d.predecessorId === predecessorId)) return
    if (hasCycle(deps, predecessorId, task.id)) {
      alert('循環依存が発生するため追加できません')
      return
    }
    await dependencyRepository.create({ predecessorId, successorId: task.id, type: 'FS', lag: 0 })
  }

  const handleDurationChange = (value: string) => {
    const duration = Math.max(0, Number(value) || 0)
    setFormState((current) => ({ ...current, duration: String(duration), work: String(durationToWork(duration, calendar.hoursPerDay)) }))
  }

  const handleWorkChange = (value: string) => {
    const work = Math.max(0, Number(value) || 0)
    setFormState((current) => ({ ...current, work: String(work), duration: String(workToDuration(work, calendar.hoursPerDay)) }))
  }

  const handleSave = async () => {
    try {
      let duration = task.duration
      let work = task.work
      let endDate = formState.endDate
      if (durationEditable) {
        // duration=0 は「点」であるマイルストーンを表す
        duration = Math.max(0, Number(formState.duration) || 0)
        work = Math.max(0, Number(formState.work) || 0)
        // このタスクの実際の終了日はDB非破壊の自動計算(computeAutomaticDates)が都度算出するが、
        // isMilestone判定や次回表示の起点として矛盾のない値をDBにも書いておく
        const anchor = parseISO(startDateEditable ? formState.startDate : task.startDate)
        const computedEnd = duration <= 0 ? nextWorkingDay(anchor, calendar) : addWorkdays(anchor, duration, calendar)
        endDate = format(computedEnd, 'yyyy-MM-dd')
      } else if (formState.isManual && !hasChildren) {
        // 手動: ユーザーが指定した日付間隔から逆算して保存しておく
        duration = formState.startDate === formState.endDate ? 0 : countWorkdays(parseISO(formState.startDate), parseISO(formState.endDate), calendar)
        work = durationToWork(duration, calendar.hoursPerDay)
      }

      await taskRepository.update(task.id, {
        name: formState.name.trim() || task.name,
        // hasChildren のときは日付・進捗を送らない（子から自動集計のため）
        ...(hasChildren
          ? {}
          : {
              ...(startDateEditable ? { startDate: formState.startDate } : {}),
              ...(endDateEditable || durationEditable ? { endDate } : {}),
              progress: Math.min(100, Math.max(0, Number(formState.progress) || 0)),
              duration,
              work,
              isManual: formState.isManual,
            }),
        assigneeId: formState.assigneeId || undefined,
      })
    } catch (err) {
      console.error('Failed to save task:', err)
      alert('保存に失敗しました')
    }
  }

  const handleDelete = async () => {
    const descendants = getDescendantTaskIds(tasks, task.id)
    const message =
      descendants.length > 0
        ? `${task.name} と ${descendants.length} 件の子タスクを削除します。よろしいですか？`
        : `${task.name} を削除しますか？`

    if (!window.confirm(message)) return

    try {
      await taskRepository.delete(task.id)
      onClose()
    } catch (err) {
      console.error('Failed to delete task:', err)
      alert('削除に失敗しました')
    }
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

        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            checked={formState.isManual}
            disabled={hasChildren}
            onChange={(event) => setFormState((current) => ({ ...current, isManual: event.target.checked }))}
          />
          手動スケジュール
          <span className="font-normal text-zinc-400">（オフ＝依存関係とカレンダーから自動計算）</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">開始日</span>
            <div title={!startDateEditable ? '依存関係・子タスクから自動算出されます' : undefined}>
              <Input
                type="date"
                value={hasChildren ? task.startDate : formState.startDate}
                disabled={!startDateEditable}
                className={!startDateEditable ? 'cursor-not-allowed opacity-60' : ''}
                onChange={(event) => setFormState((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>
          </div>
          <div className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">終了日</span>
            <div title={!endDateEditable ? '期間・依存関係・子タスクから自動算出されます' : undefined}>
              <Input
                type="date"
                value={hasChildren ? task.endDate : formState.endDate}
                disabled={!endDateEditable}
                className={!endDateEditable ? 'cursor-not-allowed opacity-60' : ''}
                onChange={(event) => setFormState((current) => ({ ...current, endDate: event.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">期間（稼働日）</span>
            <div title={!durationEditable ? '日付や子タスクから自動算出されます' : undefined}>
              <Input
                type="number"
                min={0}
                value={durationEditable ? formState.duration : String(displayDuration)}
                disabled={!durationEditable}
                className={!durationEditable ? 'cursor-not-allowed opacity-60' : ''}
                onChange={(event) => handleDurationChange(event.target.value)}
              />
            </div>
          </div>
          <div className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">工数（人時）</span>
            <div title={!durationEditable ? '期間から自動算出されます' : undefined}>
              <Input
                type="number"
                min={0}
                value={durationEditable ? formState.work : String(displayWork)}
                disabled={!durationEditable}
                className={!durationEditable ? 'cursor-not-allowed opacity-60' : ''}
                onChange={(event) => handleWorkChange(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">進捗 (%)</span>
          <div title={hasChildren ? '子タスクから自動算出されます' : undefined}>
            <Input
              type="number"
              min={0}
              max={100}
              value={hasChildren ? String(task.progress) : formState.progress}
              disabled={hasChildren}
              className={hasChildren ? 'cursor-not-allowed opacity-60' : ''}
              onChange={(event) => setFormState((current) => ({ ...current, progress: event.target.value }))}
            />
          </div>
        </div>

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

        {isMilestone && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-amber-600">◇</span>
            <span className="text-sm font-medium text-amber-700">マイルストーン</span>
          </div>
        )}

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

export function TaskSidePanel({ tasks, users, calendar }: TaskSidePanelProps) {
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
          <TaskSidePanelContent key={task.id} task={task} tasks={tasks} users={users} calendar={calendar} onClose={closeSidePanel} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
