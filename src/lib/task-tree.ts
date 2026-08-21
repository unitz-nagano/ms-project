import type { Task } from '@/lib/db'

export interface OrderedTask extends Task {
  depth: number
  hasChildren: boolean
  isVisible: boolean
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

export function buildOrderedTasks(tasks: Task[]) {
  const { childMap, sortedTasks } = getChildMap(tasks)
  const orderedTasks: OrderedTask[] = []
  const visited = new Set<string>()

  const visit = (task: Task, depth: number, ancestorsExpanded: boolean) => {
    if (visited.has(task.id)) return

    visited.add(task.id)

    const children = childMap.get(task.id) ?? []
    orderedTasks.push({
      ...task,
      depth,
      hasChildren: children.length > 0,
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
