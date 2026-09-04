import { addDays, format, parseISO } from 'date-fns'
import type { Dependency, Project, Task } from '@/lib/db'

export interface CalendarConfig {
  hoursPerDay: number
  nonWorkingWeekdays: number[]
  nonWorkingDates: string[]
}

export const DEFAULT_CALENDAR: CalendarConfig = {
  hoursPerDay: 8,
  nonWorkingWeekdays: [0, 6],
  nonWorkingDates: [],
}

export function calendarFromProject(project: Pick<Project, 'hoursPerDay' | 'nonWorkingWeekdays' | 'nonWorkingDates'>): CalendarConfig {
  return {
    hoursPerDay: project.hoursPerDay,
    nonWorkingWeekdays: project.nonWorkingWeekdays,
    nonWorkingDates: project.nonWorkingDates,
  }
}

function isWorkingDay(date: Date, calendar: CalendarConfig): boolean {
  if (calendar.nonWorkingWeekdays.includes(date.getDay())) return false
  return !calendar.nonWorkingDates.includes(format(date, 'yyyy-MM-dd'))
}

export function nextWorkingDay(date: Date, calendar: CalendarConfig): Date {
  let d = date
  while (!isWorkingDay(d, calendar)) d = addDays(d, 1)
  return d
}

/** start を起点に (workdays) 稼働日ぶん進めた日を返す。start 自体が非稼働日なら次の稼働日にシフトしてから数える */
export function addWorkdays(start: Date, workdays: number, calendar: CalendarConfig): Date {
  let d = nextWorkingDay(start, calendar)
  let remaining = Math.max(workdays, 1) - 1
  while (remaining > 0) {
    d = addDays(d, 1)
    if (isWorkingDay(d, calendar)) remaining--
  }
  return d
}

/** start〜end(inclusive)の稼働日数を数える */
export function countWorkdays(start: Date, end: Date, calendar: CalendarConfig): number {
  let count = 0
  let d = start
  while (d.getTime() <= end.getTime()) {
    if (isWorkingDay(d, calendar)) count++
    d = addDays(d, 1)
  }
  return Math.max(count, 1)
}

export function durationToWork(duration: number, hoursPerDay: number): number {
  return duration * hoursPerDay
}

export function workToDuration(work: number, hoursPerDay: number): number {
  return Math.max(1, Math.round(work / hoursPerDay))
}

/**
 * 自動スケジュール(isManual=false)タスクの開始日・終了日をFS依存関係+カレンダーから計算する。
 * 既存のサマリー集計(computeSummary)と同じく、DBは書き換えずメモリ上の値だけを返す。
 * ponytail: 親(サマリー)タスクを先行/後続に持つ依存はレアケースとして未サポート、通常のリーフ間依存のみ想定
 */
export function computeAutomaticDates(
  tasks: Task[],
  dependencies: Dependency[],
  calendar: CalendarConfig,
): Map<string, { startDate: string; endDate: string }> {
  const result = new Map<string, { startDate: string; endDate: string }>()
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const childParentIds = new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId))

  const predsBySuccessor = new Map<string, Dependency[]>()
  for (const dep of dependencies) {
    const list = predsBySuccessor.get(dep.successorId) ?? []
    list.push(dep)
    predsBySuccessor.set(dep.successorId, list)
  }

  const getDate = (id: string, key: 'startDate' | 'endDate') => result.get(id)?.[key] ?? taskMap.get(id)?.[key]

  const visited = new Set<string>()
  const visit = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)

    const task = taskMap.get(id)
    if (!task) return
    // サマリー(親)タスクは子から自動集計されるため対象外
    if (childParentIds.has(id)) return

    const preds = predsBySuccessor.get(id) ?? []
    for (const dep of preds) visit(dep.predecessorId)

    if (task.isManual) return

    if (preds.length === 0) {
      // duration<=0 は「点」であるマイルストーンとして扱う(開始日=終了日)
      const start = nextWorkingDay(parseISO(task.startDate), calendar)
      const end = task.duration <= 0 ? start : addWorkdays(start, task.duration, calendar)
      result.set(id, { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') })
      return
    }

    let latestStart: Date | null = null
    for (const dep of preds) {
      const predEnd = getDate(dep.predecessorId, 'endDate')
      if (!predEnd) continue
      const afterPred = addDays(parseISO(predEnd), 1)
      const candidate = addWorkdays(afterPred, dep.lag + 1, calendar)
      if (!latestStart || candidate.getTime() > latestStart.getTime()) latestStart = candidate
    }
    if (!latestStart) return

    const start = latestStart
    const end = task.duration <= 0 ? start : addWorkdays(start, task.duration, calendar)
    result.set(id, { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') })
  }

  for (const task of tasks) visit(task.id)
  return result
}
