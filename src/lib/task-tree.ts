import type { Task } from '@/lib/db'
import { differenceInCalendarDays, parseISO } from 'date-fns'

export interface OrderedTask extends Task {
  depth: number
  hasChildren: boolean
  isVisible: boolean
  /** 子タスクから自動集計された値かどうか（true のとき UI でロックする） */
  isComputed?: boolean
}

function getChildMap(tasks: Task[]) {
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  const taskMap = new Map(sortedTasks.map((task) => [task.id, task]))
  const childMap = new Map<string | null, Task[]>()

  const pushChild = (key: string | null, task: Task) => {
    const siblings = childMap.get(key) ?? []
    siblings.push(task)
    childMap.set(key, siblings)
  }

  for (const task of sortedTasks) {
    const parentKey = task.parentId && task.parentId !== task.id && taskMap.has(task.parentId) ? task.parentId : null
    pushChild(parentKey, task)
  }

  return { childMap, sortedTasks }
}

/** 子タスクから startDate/endDate/progress を期間加重平均で集計する（メモリのみ、DB不変） */
function computeSummary(
  children: OrderedTask[],
): Pick<Task, 'startDate' | 'endDate' | 'progress'> {
  const starts = children.map((c) => c.startDate)
  const ends = children.map((c) => c.endDate)
  const startDate = starts.reduce((a, b) => (a < b ? a : b))
  const endDate = ends.reduce((a, b) => (a > b ? a : b))

  const totalDays = children.reduce(
    (sum, c) => sum + differenceInCalendarDays(parseISO(c.endDate), parseISO(c.startDate)),
    0,
  )

  let progress: number
  if (totalDays === 0) {
    // 全子がマイルストーン（0日）→ 単純平均
    progress = Math.round(children.reduce((sum, c) => sum + c.progress, 0) / children.length)
  } else {
    const weighted = children.reduce((sum, c) => {
      const days = differenceInCalendarDays(parseISO(c.endDate), parseISO(c.startDate))
      return sum + days * c.progress
    }, 0)
    progress = Math.round(weighted / totalDays)
  }

  return { startDate, endDate, progress }
}

export function buildOrderedTasks(tasks: Task[]) {
  const { childMap, sortedTasks } = getChildMap(tasks)
  const orderedTasks: OrderedTask[] = []
  const visited = new Set<string>()

  const visit = (task: Task, depth: number, ancestorsExpanded: boolean) => {
    if (visited.has(task.id)) return

    visited.add(task.id)

    const children = childMap.get(task.id) ?? []
    const hasChildren = children.length > 0

    // startDate === endDate なら自動的にマイルストーン扱い
    const isMilestone = task.isMilestone || task.startDate === task.endDate

    orderedTasks.push({
      ...task,
      isMilestone,
      depth,
      hasChildren,
      isVisible: ancestorsExpanded,
    })

    for (const child of children) {
      visit(child, depth + 1, ancestorsExpanded && task.isExpanded)
    }
  }

  for (const rootTask of childMap.get(null) ?? []) {
    visit(rootTask, 0, true)
  }

  for (const task of sortedTasks) {
    if (!visited.has(task.id)) {
      visit(task, 0, true)
    }
  }

  // 孫→子→親 の順で集計（深いノードから処理するため後ろから走査）
  const taskIndexMap = new Map(orderedTasks.map((t, i) => [t.id, i]))
  for (let i = orderedTasks.length - 1; i >= 0; i--) {
    const task = orderedTasks[i]
    if (!task.hasChildren) continue

    const children = (childMap.get(task.id) ?? [])
      .map((c) => orderedTasks[taskIndexMap.get(c.id) ?? -1])
      .filter((c): c is OrderedTask => c !== undefined)

    const summary = computeSummary(children)
    orderedTasks[i] = {
      ...task,
      ...summary,
      isComputed: true,
    }
  }

  return {
    orderedTasks,
    visibleTasks: orderedTasks.filter((task) => task.isVisible),
  }
}

export function getDescendantTaskIds(tasks: Task[], taskId: string) {
  const descendants: string[] = []
  const queue = [taskId]

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId) continue

    const children = tasks.filter((task) => task.parentId === currentId)
    for (const child of children) {
      descendants.push(child.id)
      queue.push(child.id)
    }
  }

  return descendants
}

export function getNextTaskOrder(tasks: Task[]) {
  return tasks.reduce((maxOrder, task) => Math.max(maxOrder, task.order), -1) + 1
}

export function hasCycle(
  existingDeps: { predecessorId: string; successorId: string }[],
  newPredId: string,
  newSuccId: string,
): boolean {
  const adj = new Map<string, string[]>()
  for (const d of existingDeps) {
    const list = adj.get(d.predecessorId) ?? []
    list.push(d.successorId)
    adj.set(d.predecessorId, list)
  }
  // newSuccId から newPredId に到達できればサイクル
  const visited = new Set<string>()
  const stack = [newSuccId]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === newPredId) return true
    if (visited.has(cur)) continue
    visited.add(cur)
    for (const next of adj.get(cur) ?? []) stack.push(next)
  }
  return false
}
