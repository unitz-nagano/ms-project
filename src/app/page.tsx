'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, FolderKanban, Plus, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useProjects } from '@/hooks/useProjects'
import { projectRepository } from '@/repositories'
import { DEFAULT_CALENDAR } from '@/lib/scheduling'

const DEFAULT_PROJECT_FORM = {
  name: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
}

function formatProjectDate(value?: string) {
  if (!value) return '未設定'
  try {
    return format(parseISO(value), 'yyyy/MM/dd')
  } catch {
    return value
  }
}

export default function Home() {
  const router = useRouter()
  const projects = useProjects()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formState, setFormState] = useState(DEFAULT_PROJECT_FORM)

  const projectCountLabel = useMemo(() => `${projects.length} 件のプロジェクト`, [projects.length])

  const handleCreateProject = async () => {
    const trimmedName = formState.name.trim()
    if (!trimmedName) return

    const createdProject = await projectRepository.create({
      name: trimmedName,
      startDate: formState.startDate,
      endDate: formState.endDate || undefined,
      hoursPerDay: DEFAULT_CALENDAR.hoursPerDay,
      nonWorkingWeekdays: DEFAULT_CALENDAR.nonWorkingWeekdays,
      nonWorkingDates: DEFAULT_CALENDAR.nonWorkingDates,
    })

    setFormState(DEFAULT_PROJECT_FORM)
    setIsDialogOpen(false)
    router.push(`/projects/${createdProject.id}`)
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!window.confirm(`${projectName} を削除しますか？関連タスクも削除されます。`)) return
    await projectRepository.delete(projectId)
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-8">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Phase 2: タスク CRUD
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">MS Project 代替</h1>
              <p className="mt-2 text-sm text-zinc-600">IndexedDB 上のプロジェクトとタスクをローカルで管理します。</p>
            </div>
            <p className="text-sm text-zinc-500">{projectCountLabel}</p>
          </div>
          <Button className="gap-2 self-start sm:self-auto" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            新規プロジェクト
          </Button>
        </div>

        {projects.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center shadow-sm">
            <FolderKanban className="mx-auto mb-4 h-12 w-12 text-zinc-300" />
            <h2 className="text-xl font-semibold text-zinc-900">プロジェクトがありません</h2>
            <p className="mt-2 text-sm text-zinc-500">最初のプロジェクトを作成して、タスク CRUD を始めましょう。</p>
            <Button className="mt-6 gap-2" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              プロジェクトを作成
            </Button>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <button
                  type="button"
                  className="absolute inset-0 z-0"
                  onClick={() => router.push(`/projects/${project.id}`)}
                  aria-label={`${project.name} を開く`}
                />
                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <h2 className="text-xl font-semibold text-zinc-950">{project.name}</h2>
                    <div className="space-y-1 text-sm text-zinc-500">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        開始: {formatProjectDate(project.startDate)}
                      </p>
                      <p>終了: {formatProjectDate(project.endDate)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="relative z-20 rounded-md p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDeleteProject(project.id, project.name)
                    }}
                    aria-label={`${project.name} を削除`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative z-10 mt-6 text-sm text-blue-700">
                  <Link href={`/projects/${project.id}`}>プロジェクトを開く →</Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="新規プロジェクト">
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">プロジェクト名</span>
            <Input
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              placeholder="例: 2026年度 開発計画"
            />
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
          <div className="flex justify-end gap-2 pt-2">
            <Button className="bg-zinc-200 text-zinc-900 hover:bg-zinc-300" onClick={() => setIsDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={() => void handleCreateProject()}>作成</Button>
          </div>
        </div>
      </Dialog>
    </main>
  )
}
