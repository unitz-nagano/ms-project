import { create } from 'zustand'

interface AppState {
  selectedTaskId: string | null
  isSidePanelOpen: boolean
  panelWidth: number // タスクテーブルの幅(px)
  /** true: 「タスク追加」直後のタスクを開いている（保存成功時にパネルを閉じる） */
  isCreatingNewTask: boolean

  selectTask: (id: string | null) => void
  openSidePanel: (taskId: string, isNew?: boolean) => void
  closeSidePanel: () => void
  setPanelWidth: (width: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedTaskId: null,
  isSidePanelOpen: false,
  panelWidth: 400,
  isCreatingNewTask: false,

  selectTask: (id) => set({ selectedTaskId: id }),
  openSidePanel: (taskId, isNew = false) => set({ selectedTaskId: taskId, isSidePanelOpen: true, isCreatingNewTask: isNew }),
  closeSidePanel: () => set({ isSidePanelOpen: false, selectedTaskId: null, isCreatingNewTask: false }),
  setPanelWidth: (width) => set({ panelWidth: width }),
}))
