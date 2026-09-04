'use client'

import { useMemo, useRef, type RefObject } from 'react'
import {
  createColumnHelper,
  columnResizingFeature,
  columnSizingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { UserBadge } from '@/components/users/UserBadge'
import { useAppStore } from '@/store/useAppStore'
import { taskRepository } from '@/repositories'
import { getNextTaskOrder, type OrderedTask } from '@/lib/task-tree'
import { DEFAULT_CALENDAR, durationToWork } from '@/lib/scheduling'
import type { Task, User } from '@/lib/db'

interface TaskTableProps {
  projectId: string
  tasks: Task[]
  rows: OrderedTask[]
  users: User[]
  scrollRef?: RefObject<HTMLDivElement | null>
  onVerticalScroll?: (scrollTop: number) => void
}

const features = tableFeatures({
  columnSizingFeature,
  columnResizingFeature,
})

type TaskRow = OrderedTask & {
  assigneeName: string
  assigneeColor?: string
}

const columnHelper = createColumnHelper<typeof features, TaskRow>()
const columns = columnHelper.columns([
  columnHelper.accessor('name', {
    id: 'name',
    header: 'タスク名',
    size: 320,
    minSize: 220,
    cell: ({ row }) => row.original.name,
  }),
  columnHelper.accessor('startDate', {
    id: 'startDate',
    header: '開始日',
    size: 140,
    minSize: 120,
    cell: ({ row }) => formatDate(row.original.startDate),
  }),
  columnHelper.accessor('endDate', {
    id: 'endDate',
    header: '終了日',
    size: 140,
    minSize: 120,
    cell: ({ row }) => formatDate(row.original.endDate),
  }),
  columnHelper.accessor('progress', {
    id: 'progress',
    header: '進捗',
    size: 110,
    minSize: 90,
    cell: ({ row }) => `${row.original.progress}%`,
  }),
  columnHelper.accessor('assigneeName', {
    id: 'assigneeName',
    header: '担当者',
    size: 160,
    minSize: 120,
    cell: ({ row }) => row.original.assigneeName,
  }),
])

function formatDate(value: string) {
  try {
    return format(parseISO(value), 'yyyy/MM/dd')
  } catch {
    return value
  }
}

export function TaskTable({ projectId, tasks, rows, users, scrollRef, onVerticalScroll }: TaskTableProps) {
  const { selectedTaskId, selectTask, openSidePanel } = useAppStore()
  const internalRef = useRef<HTMLDivElement>(null)
  const containerRef = scrollRef ?? internalRef
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])

  const data = useMemo<TaskRow[]>(
    () =>
      rows.map((task) => {
        const assignee = task.assigneeId ? userMap.get(task.assigneeId) : undefined
        return {
          ...task,
          assigneeName: assignee?.name ?? '—',
          assigneeColor: assignee?.color,
        }
      }),
    [rows, userMap],
  )

  const table = useTable({
    features,
    data,
    columns,
    getRowId: (row) => row.id,
    columnResizeMode: 'onChange',
    defaultColumn: {
      size: 140,
      minSize: 80,
    },
  })

  const handleAddTask = async () => {
    const nextOrder = getNextTaskOrder(tasks)
    const fallbackDate = new Date().toISOString().slice(0, 10)
    const referenceTask = rows.at(-1)

    const createdTask = await taskRepository.create({
      projectId,
      parentId: undefined,
      name: `新規タスク ${nextOrder + 1}`,
      startDate: referenceTask?.startDate ?? fallbackDate,
      endDate: referenceTask?.endDate ?? fallbackDate,
      progress: 0,
      isMilestone: false,
      order: nextOrder,
      assigneeId: undefined,
      isExpanded: true,
      duration: 1,
      work: durationToWork(1, DEFAULT_CALENDAR.hoursPerDay),
      isManual: false,
    })

    openSidePanel(createdTask.id)
  }

  const handleIndent = async (targetId: string) => {
    const targetIndex = rows.findIndex((task) => task.id === targetId)
    if (targetIndex <= 0) return

    const targetTask = tasks.find((task) => task.id === targetId)
    const previousTask = rows[targetIndex - 1]
    if (!targetTask || !previousTask) return

    await taskRepository.update(targetId, {
      parentId: previousTask.id,
    })

    if (!previousTask.isExpanded) {
      await taskRepository.update(previousTask.id, { isExpanded: true })
    }
  }

  const handleOutdent = async (targetId: string) => {
    const targetTask = tasks.find((task) => task.id === targetId)
    if (!targetTask?.parentId) return

    const parentTask = tasks.find((task) => task.id === targetTask.parentId)
    await taskRepository.update(targetId, {
      parentId: parentTask?.parentId,
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">タスク一覧</h2>
          <p className="text-xs text-zinc-500">Tab / Shift+Tab で階層変更</p>
        </div>
        <Button className="gap-2" onClick={() => void handleAddTask()}>
          <Plus className="h-4 w-4" />
          タスク追加
        </Button>
      </div>

      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-auto"
        tabIndex={0}
        onScroll={() => {
          if (containerRef.current) onVerticalScroll?.(containerRef.current.scrollTop)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || !selectedTaskId) return

          event.preventDefault()
          if (event.shiftKey) {
            void handleOutdent(selectedTaskId)
          } else {
            void handleIndent(selectedTaskId)
          }
        }}
      >
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="relative border-b border-r border-zinc-200 px-3 py-2 text-left font-medium text-zinc-600 last:border-r-0"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    {header.column.getCanResize() ? (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-500 ${header.column.getIsResizing() ? 'bg-blue-500' : ''}`}
                      />
                    ) : null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-zinc-500">
                  まだタスクがありません。「タスク追加」から作成してください。
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const isSelected = row.original.id === selectedTaskId
                const assignee = row.original.assigneeColor ? (
                  <UserBadge name={row.original.assigneeName} color={row.original.assigneeColor} />
                ) : (
                  <span className="text-zinc-400">—</span>
                )

                return (
                  <tr
                    key={row.id}
                    className={`cursor-pointer transition hover:bg-blue-50 ${isSelected ? 'bg-blue-50/80' : 'bg-white'}`}
                    onClick={() => {
                      containerRef.current?.focus()
                      selectTask(row.original.id)
                      openSidePanel(row.original.id)
                    }}
                  >
                    {row.getAllCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="border-b border-r border-zinc-100 px-3 py-2 align-middle last:border-r-0"
                        style={{ width: cell.column.getSize() }}
                      >
                        {cell.column.id === 'name' ? (
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${row.original.depth * 20}px` }}>
                            {row.original.hasChildren ? (
                              <button
                                type="button"
                                className="rounded p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void taskRepository.update(row.original.id, {
                                    isExpanded: !row.original.isExpanded,
                                  })
                                }}
                                aria-label={row.original.isExpanded ? '折り畳む' : '展開する'}
                              >
                                {row.original.isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            ) : (
                              <span className="w-6" />
                            )}
                            <span className="truncate font-medium text-zinc-900">{row.original.name}</span>
                          </div>
                        ) : cell.column.id === 'assigneeName' ? (
                          assignee
                        ) : (
                          <table.FlexRender cell={cell} />
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
