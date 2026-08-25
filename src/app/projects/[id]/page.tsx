'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Users } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { GanttView } from '@/components/gantt/GanttView'
import type { Dependency } from '@/lib/db'
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
  const EMPTY_DEPS: Dependency[] = []
  const dependencies = useLiveQuery(() => db.dependencies.toArray(), [], EMPTY_DEPS)
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [tableWidth, setTableWidth] = useState(520)
  const { isSidePanelOpen, panelWidth, closeSidePanel } = useAppStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidePanel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeSidePanel])

  const tableScrollRef = useRef<HTMLDivElement>(null)
  const ganttScrollRef = useRef<HTMLDivElement>(null)

  const syncGanttScroll = (scrollTop: number) => {
    if (ganttScrollRef.current) ganttScrollRef.current.scrollTop = scrollTop
  }
  const syncTableScroll = (scrollTop: number) => {
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = scrollTop
  }

  const handleResizerMouseDown = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = tableWidth
    const onMouseMove = (ev: MouseEvent) => {
      setTableWidth(Math.max(300, Math.min(startWidth + ev.clientX - startX, 900)))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  if (project === undefined) {
    return <div className="flex h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">読み込み中...</div>
  }

  if (!project) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">プロジェクトが見つかりません</h1>
        <p className="text-sm text-zinc-500">削除済み、または URL が無効です。</p>
        <Link href="/" className="text-sm font-medium text-blue-700">
          一覧に戻る
        </Link>
      </main>
    )
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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

      <div className="flex min-h-0 flex-1 gap-0 px-6 py-6">
        {/* タスクテーブル（固定幅・リサイズ可） */}
        <section
          style={{ width: tableWidth }}
          className="flex-shrink-0 overflow-hidden rounded-l-3xl border border-zinc-200 bg-white shadow-sm"
        >
          <TaskTable
            projectId={projectId}
            tasks={taskData.orderedTasks}
            rows={taskData.visibleTasks}
            users={users}
            scrollRef={tableScrollRef}
            onVerticalScroll={syncGanttScroll}
          />
        </section>

        {/* パネルリサイザー */}
        <div
          className="flex w-4 cursor-col-resize items-stretch justify-center"
          onMouseDown={handleResizerMouseDown}
        >
          <div className="my-4 w-1 rounded-full bg-zinc-200 transition-colors hover:bg-zinc-400" />
        </div>

        {/* ガントチャート（残り幅を全部使う） */}
        <section className="min-w-0 flex-1 overflow-hidden rounded-r-3xl border border-zinc-200 bg-white shadow-sm">
          <GanttView
            visibleTasks={taskData.visibleTasks}
            users={users}
            dependencies={dependencies}
            scrollRef={ganttScrollRef}
            onVerticalScroll={syncTableScroll}
          />
        </section>
      </div>

      <TaskSidePanel tasks={taskData.orderedTasks} users={users} />
      <UserManagerDialog open={isUserDialogOpen} onClose={() => setIsUserDialogOpen(false)} tasks={taskData.orderedTasks} />

      {isSidePanelOpen ? <div className="pointer-events-none fixed inset-y-0 right-0 border-l border-zinc-200" style={{ width: panelWidth }} /> : null}
    </main>
  )
}
