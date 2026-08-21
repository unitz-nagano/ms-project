'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, GanttChartSquare, Users } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { TaskSidePanel } from '@/components/tasks/TaskSidePanel'
import { TaskTable } from '@/components/tasks/TaskTable'
import { UserManagerDialog } from '@/components/users/UserManagerDialog'
import { useTasks } from '@/hooks/useTasks'
import { useUsers } from '@/hooks/useUsers'
import { db } from '@/lib/db'
import { useAppStore } from '@/store/useAppStore'

function formatDate(value?: string) {
  if (!value) return '未設定'
  try {
    return format(parseISO(value), 'yyyy/MM/dd')
  } catch {
    return value
  }
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId], undefined)
  const taskData = useTasks(projectId)
  const users = useUsers()
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const { isSidePanelOpen, panelWidth } = useAppStore()

  const ganttPlaceholderTasks = useMemo(() => taskData.visibleTasks.slice(0, 8), [taskData.visibleTasks])

  if (project === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">読み込み中...</div>
  }

  if (!project) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">プロジェクトが見つかりません</h1>
        <p className="text-sm text-zinc-500">削除済み、または URL が無効です。</p>
        <Link href="/" className="text-sm font-medium text-blue-700">
          一覧に戻る
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900">
              <ArrowLeft className="h-4 w-4" />
              プロジェクト一覧へ戻る
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-zinc-950">{project.name}</h1>
              <p className="mt-1 text-sm text-zinc-500">
                開始: {formatDate(project.startDate)} / 終了: {formatDate(project.endDate)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2 bg-zinc-200 text-zinc-900 hover:bg-zinc-300" onClick={() => setIsUserDialogOpen(true)}>
              <Users className="h-4 w-4" />
              担当者管理
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-0 px-6 py-6">
        <section className="min-w-0 flex-1 overflow-hidden rounded-l-3xl border border-zinc-200 bg-white shadow-sm">
          <TaskTable projectId={projectId} tasks={taskData.orderedTasks} rows={taskData.visibleTasks} users={users} />
        </section>

        <div className="flex w-4 items-stretch justify-center bg-transparent">
          <div className="my-4 w-1 rounded-full bg-zinc-200" />
        </div>

        <section className="flex min-w-[320px] flex-[0.8] flex-col overflow-hidden rounded-r-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">ガントエリア</h2>
              <p className="text-xs text-zinc-500">Phase 3 で read-only 描画を実装予定</p>
            </div>
            <GanttChartSquare className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="flex-1 space-y-4 overflow-auto p-5">
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
              ここにタスクバーと日付グリッドを描画します。現在はレイアウトのプレースホルダーです。
            </div>
            <div className="space-y-3">
              {ganttPlaceholderTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
                  タスクを追加するとガントのプレビュー項目が表示されます。
                </div>
              ) : (
                ganttPlaceholderTasks.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-zinc-900" style={{ paddingLeft: `${task.depth * 14}px` }}>
                        {task.name}
                      </p>
                      <span className="text-xs text-zinc-500">{task.progress}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-zinc-100">
                      <div className="h-3 rounded-full bg-blue-500" style={{ width: `${Math.max(6, task.progress)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      {formatDate(task.startDate)} - {formatDate(task.endDate)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <TaskSidePanel tasks={taskData.orderedTasks} users={users} />
      <UserManagerDialog open={isUserDialogOpen} onClose={() => setIsUserDialogOpen(false)} tasks={taskData.orderedTasks} />

      {isSidePanelOpen ? <div className="pointer-events-none fixed inset-y-0 right-0 border-l border-zinc-200" style={{ width: panelWidth }} /> : null}
    </main>
  )
}
