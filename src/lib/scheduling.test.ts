import { format, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'
import type { Dependency, Task } from '@/lib/db'
import {
  addWorkdays,
  computeAutomaticDates,
  countWorkdays,
  DEFAULT_CALENDAR,
  durationToWork,
  nextWorkingDay,
  workToDuration,
} from '@/lib/scheduling'

// 2026-08-31 は月曜日
const MON = parseISO('2026-08-31')

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'x',
    projectId: 'p',
    name: 'x',
    startDate: '2026-08-31',
    endDate: '2026-08-31',
    progress: 0,
    isMilestone: false,
    order: 0,
    isExpanded: true,
    duration: 1,
    work: 8,
    isManual: false,
    ...overrides,
  }
}

describe('scheduling', () => {
  it('countWorkdays: 土日を除いて数える', () => {
    // 月〜金(5営業日) + 次の月(1営業日) = 6
    expect(countWorkdays(MON, parseISO('2026-09-07'), DEFAULT_CALENDAR)).toBe(6)
  })

  it('addWorkdays: 非稼働日をスキップして進める', () => {
    // 金曜(9/4)を1稼働日目として3稼働日ぶん進める -> 金・月・火(土日はスキップ)で火曜(9/8)着地
    const fri = parseISO('2026-09-04')
    expect(format(addWorkdays(fri, 3, DEFAULT_CALENDAR), 'yyyy-MM-dd')).toBe('2026-09-08')
  })

  it('nextWorkingDay: 土曜日なら月曜日にシフトする', () => {
    const sat = parseISO('2026-09-05')
    expect(format(nextWorkingDay(sat, DEFAULT_CALENDAR), 'yyyy-MM-dd')).toBe('2026-09-07')
  })

  it('duration と work は hoursPerDay で相互変換できる', () => {
    expect(durationToWork(3, 8)).toBe(24)
    expect(workToDuration(24, 8)).toBe(3)
  })

  it('computeAutomaticDates: 先行タスク終了日+lagから後続タスクの日付を連鎖計算する', () => {
    const pred = makeTask({ id: 'a', startDate: '2026-08-31', endDate: '2026-09-02', duration: 3 })
    const succ = makeTask({ id: 'b', startDate: '2026-08-31', endDate: '2026-08-31', duration: 2 })
    const deps: Dependency[] = [{ id: 'd1', predecessorId: 'a', successorId: 'b', type: 'FS', lag: 0 }]

    const result = computeAutomaticDates([pred, succ], deps, DEFAULT_CALENDAR)
    // pred は先行なしなので既存の日付通り(3稼働日で 8/31月〜9/2水のまま)
    expect(result.get('a')).toEqual({ startDate: '2026-08-31', endDate: '2026-09-02' })
    // succ は pred 終了日(9/2水)の翌稼働日(9/3木)から2稼働日
    expect(result.get('b')).toEqual({ startDate: '2026-09-03', endDate: '2026-09-04' })
  })

  it('computeAutomaticDates: 手動タスクは計算対象から除外される', () => {
    const pred = makeTask({ id: 'a', startDate: '2026-08-31', endDate: '2026-09-02', duration: 3 })
    const succ = makeTask({ id: 'b', startDate: '2026-08-31', endDate: '2026-08-31', duration: 2, isManual: true })
    const deps: Dependency[] = [{ id: 'd1', predecessorId: 'a', successorId: 'b', type: 'FS', lag: 0 }]

    const result = computeAutomaticDates([pred, succ], deps, DEFAULT_CALENDAR)
    expect(result.get('b')).toBeUndefined()
  })
})
