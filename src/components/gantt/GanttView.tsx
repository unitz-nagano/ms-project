'use client'

import { useMemo, useState, type RefObject } from 'react'
import { differenceInCalendarDays, parseISO, format, addDays } from 'date-fns'
import type { OrderedTask } from '@/lib/task-tree'
import type { Dependency, User } from '@/lib/db'
import { taskRepository } from '@/repositories'

// ponytail: ROW_H must match TaskTable td height (py-2 + text-sm ≈ 36px)
const DAY_W = 40
const ROW_H = 36
const HEADER_H = 52
const HANDLE_W = 6

interface GanttViewProps {
  visibleTasks: OrderedTask[]
  users: User[]
  dependencies: Dependency[]
  scrollRef?: RefObject<HTMLDivElement | null>
  onVerticalScroll?: (scrollTop: number) => void
}

type DragState = {
  taskId: string
  type: 'move' | 'resize-left' | 'resize-right'
  startClientX: number
  origStartDate: string
  origEndDate: string
}

export function GanttView({ visibleTasks, users, dependencies, scrollRef, onVerticalScroll }: GanttViewProps) {
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const [drag, setDrag] = useState<DragState | null>(null)
  const [preview, setPreview] = useState<{ startDate: string; endDate: string } | null>(null)

  const { ganttStart, numDays } = useMemo(() => {
    if (visibleTasks.length === 0) {
      const today = new Date()
      return { ganttStart: addDays(today, -14), numDays: 90 }
    }
    const parsed = visibleTasks.flatMap((t) => [parseISO(t.startDate), parseISO(t.endDate)])
    const minDate = new Date(Math.min(...parsed.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...parsed.map((d) => d.getTime())))
    const start = addDays(minDate, -7)
    const end = addDays(maxDate, 14)
    return { ganttStart: start, numDays: differenceInCalendarDays(end, start) + 1 }
  }, [visibleTasks])

  const totalWidth = numDays * DAY_W
  const bodyHeight = Math.max(visibleTasks.length * ROW_H, 200)
  const todayOff = differenceInCalendarDays(new Date(), ganttStart)

  const visibleTaskIds = useMemo(() => new Set(visibleTasks.map((t) => t.id)), [visibleTasks])
  const rowIndexMap = useMemo(
    () => new Map(visibleTasks.map((t, i) => [t.id, i])),
    [visibleTasks],
  )
  const visibleDeps = useMemo(
    () => dependencies.filter((d) => visibleTaskIds.has(d.predecessorId) && visibleTaskIds.has(d.successorId)),
    [dependencies, visibleTaskIds],
  )

  const days = useMemo(
    () => Array.from({ length: numDays }, (_, i) => addDays(ganttStart, i)),
    [ganttStart, numDays],
  )

  const months = useMemo(() => {
    const result: { label: string; startIdx: number }[] = []
    let currentKey = ''
    days.forEach((day, i) => {
      const key = format(day, 'yyyy-MM')
      if (key !== currentKey) {
        result.push({ label: format(day, 'yyyy年M月'), startIdx: i })
        currentKey = key
      }
    })
    return result
  }, [days])

  const handleBarPointerDown = (
    e: React.PointerEvent<SVGElement>,
    task: OrderedTask,
    type: DragState['type'],
  ) => {
    e.stopPropagation()
    ;(e.currentTarget as SVGElement).setPointerCapture(e.pointerId)
    setDrag({
      taskId: task.id,
      type,
      startClientX: e.clientX,
      origStartDate: task.startDate,
      origEndDate: task.endDate,
    })
    setPreview({ startDate: task.startDate, endDate: task.endDate })
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const deltaDays = Math.round((e.clientX - drag.startClientX) / DAY_W)
    const origStart = parseISO(drag.origStartDate)
    const origEnd = parseISO(drag.origEndDate)
    const duration = differenceInCalendarDays(origEnd, origStart)

    let newStart = drag.origStartDate
    let newEnd = drag.origEndDate

    if (drag.type === 'move') {
      newStart = addDays(origStart, deltaDays).toISOString().slice(0, 10)
      newEnd = addDays(origEnd, deltaDays).toISOString().slice(0, 10)
    } else if (drag.type === 'resize-left') {
      newStart = addDays(origStart, Math.min(deltaDays, duration)).toISOString().slice(0, 10)
    } else {
      newEnd = addDays(origEnd, Math.max(deltaDays, -duration)).toISOString().slice(0, 10)
    }

    setPreview({ startDate: newStart, endDate: newEnd })
  }

  const handlePointerUp = async () => {
    if (!drag || !preview) {
      setDrag(null)
      setPreview(null)
      return
    }
    const { taskId, origStartDate, origEndDate } = drag
    const { startDate, endDate } = preview
    setDrag(null)
    setPreview(null)
    if (startDate !== origStartDate || endDate !== origEndDate) {
      try {
        await taskRepository.update(taskId, { startDate, endDate })
      } catch (err) {
        console.error('Failed to update task dates:', err)
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">ガントチャート</h2>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto"
        onScroll={(e) => onVerticalScroll?.(e.currentTarget.scrollTop)}
      >
        {/* 月・日の見出し（縦スクロール時に sticky） */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
          <svg width={totalWidth} height={HEADER_H} className="block">
            {months.map((m) => (
              <g key={`${m.label}-${m.startIdx}`}>
                <line x1={m.startIdx * DAY_W} y1={0} x2={m.startIdx * DAY_W} y2={HEADER_H} stroke="#e4e4e7" strokeWidth={1} />
                <text x={m.startIdx * DAY_W + 6} y={18} fontSize={11} fill="#374151" fontWeight={600} fontFamily="inherit">
                  {m.label}
                </text>
              </g>
            ))}
            <line x1={0} y1={HEADER_H / 2} x2={totalWidth} y2={HEADER_H / 2} stroke="#e4e4e7" strokeWidth={1} />
            {days.map((day, i) => (
              <g key={i}>
                <line x1={i * DAY_W} y1={HEADER_H / 2} x2={i * DAY_W} y2={HEADER_H} stroke="#e4e4e7" strokeWidth={1} />
                <text x={i * DAY_W + DAY_W / 2} y={42} fontSize={10} fill="#9ca3af" textAnchor="middle" fontFamily="inherit">
                  {format(day, 'd')}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* グリッド＋タスクバー */}
        <svg
          width={totalWidth}
          height={bodyHeight}
          className="block"
          style={{ cursor: drag ? 'grabbing' : 'default' }}
          onPointerMove={handlePointerMove}
          onPointerUp={() => void handlePointerUp()}
          onPointerLeave={() => void handlePointerUp()}
        >
          <defs>
            <marker id="dep-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <path d="M0,0 L0,7 L7,3.5 z" fill="#94a3b8" />
            </marker>
          </defs>
          {/* 週末の背景 */}
          {days.map((day, i) =>
            day.getDay() === 0 || day.getDay() === 6 ? (
              <rect key={i} x={i * DAY_W} y={0} width={DAY_W} height={bodyHeight} fill="#f9fafb" />
            ) : null,
          )}
          {/* 縦グリッド線 */}
          {days.map((_, i) => (
            <line key={i} x1={i * DAY_W} y1={0} x2={i * DAY_W} y2={bodyHeight} stroke="#f3f4f6" strokeWidth={1} />
          ))}
          {/* 行区切り線 */}
          {visibleTasks.map((_, i) => (
            <line key={i} x1={0} y1={(i + 1) * ROW_H} x2={totalWidth} y2={(i + 1) * ROW_H} stroke="#f3f4f6" strokeWidth={1} />
          ))}
          {/* 今日線 */}
          {todayOff >= 0 && todayOff < numDays && (
            <line x1={todayOff * DAY_W} y1={0} x2={todayOff * DAY_W} y2={bodyHeight} stroke="#3b82f6" strokeWidth={1.5} opacity={0.5} />
          )}
          {/* タスクバー */}
          {visibleTasks.map((task, rowIndex) => {
            const effectiveStart = drag?.taskId === task.id && preview ? preview.startDate : task.startDate
            const effectiveEnd = drag?.taskId === task.id && preview ? preview.endDate : task.endDate
            const startOff = differenceInCalendarDays(parseISO(effectiveStart), ganttStart)
            const endOff = differenceInCalendarDays(parseISO(effectiveEnd), ganttStart)
            const barW = Math.max((endOff - startOff + 1) * DAY_W, 8)
            const x = startOff * DAY_W
            const cy = rowIndex * ROW_H + ROW_H / 2
            const color = task.assigneeId ? (userMap.get(task.assigneeId)?.color ?? '#3b82f6') : '#3b82f6'
            const isDragging = drag?.taskId === task.id

            if (task.isMilestone) {
              const s = 8
              return (
                <polygon
                  key={task.id}
                  points={`${x},${cy - s} ${x + s},${cy} ${x},${cy + s} ${x - s},${cy}`}
                  fill={color}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => handleBarPointerDown(e, task, 'move')}
                />
              )
              // リサイズハンドルなし（マイルストーンは点なので不要）
            }

            if (task.hasChildren) {
              return (
                // ponytail: サマリータスクは子から自動集計のため操作不可
                <rect
                  key={task.id}
                  x={x}
                  y={cy - 3}
                  width={barW}
                  height={6}
                  rx={1}
                  fill="#374151"
                  style={{ pointerEvents: 'none' }}
                />
              )
            }

            const h = 16
            const y = cy - h / 2
            const progressW = Math.max(barW * (task.progress / 100), task.progress > 0 ? 6 : 0)
            return (
              <g key={task.id} opacity={isDragging ? 0.7 : 1}>
                <rect x={x} y={y} width={barW} height={h} rx={3} fill={color} opacity={0.25} />
                {task.progress > 0 && (
                  <rect x={x} y={y} width={progressW} height={h} rx={3} fill={color} />
                )}
                {barW >= 40 && task.progress > 0 && (
                  <text
                    x={x + Math.min(progressW / 2, barW / 2)}
                    y={cy + 4}
                    fontSize={9}
                    fill="white"
                    textAnchor="middle"
                    fontFamily="inherit"
                    pointerEvents="none"
                  >
                    {task.progress}%
                  </text>
                )}
                {/* 左リサイズハンドル */}
                <rect
                  x={x}
                  y={y}
                  width={HANDLE_W}
                  height={h}
                  fill="transparent"
                  style={{ cursor: 'ew-resize' }}
                  onPointerDown={(e) => handleBarPointerDown(e, task, 'resize-left')}
                />
                {/* 移動ハンドル（バー中央） */}
                <rect
                  x={x + HANDLE_W}
                  y={y}
                  width={Math.max(barW - HANDLE_W * 2, 0)}
                  height={h}
                  fill="transparent"
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => handleBarPointerDown(e, task, 'move')}
                />
                {/* 右リサイズハンドル */}
                <rect
                  x={x + barW - HANDLE_W}
                  y={y}
                  width={HANDLE_W}
                  height={h}
                  fill="transparent"
                  style={{ cursor: 'ew-resize' }}
                  onPointerDown={(e) => handleBarPointerDown(e, task, 'resize-right')}
                />
              </g>
            )
          })}
          {/* 依存矢印（elbow 型） */}
          {visibleDeps.map((dep) => {
            const predIdx = rowIndexMap.get(dep.predecessorId)
            const succIdx = rowIndexMap.get(dep.successorId)
            if (predIdx === undefined || succIdx === undefined) return null

            const pred = visibleTasks[predIdx]
            const succ = visibleTasks[succIdx]
            const predEndOff = differenceInCalendarDays(
              parseISO(drag?.taskId === pred.id && preview ? preview.endDate : pred.endDate),
              ganttStart,
            )
            const succStartOff = differenceInCalendarDays(
              parseISO(drag?.taskId === succ.id && preview ? preview.startDate : succ.startDate),
              ganttStart,
            )

            const x1 = (predEndOff + 1) * DAY_W
            const y1 = predIdx * ROW_H + ROW_H / 2
            const x2 = succStartOff * DAY_W
            const y2 = succIdx * ROW_H + ROW_H / 2
            // ponytail: elbow は right→down→right。逆転時は右に16px出してから折れる
            const midX = Math.max(x1 + 16, (x1 + x2) / 2)
            const d = `M${x1},${y1} H${midX} V${y2} H${x2}`

            return (
              <path
                key={dep.id}
                d={d}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.5}
                markerEnd="url(#dep-arrow)"
              />
            )
          })}
        </svg>
      </div>
    </div>
  )
}
