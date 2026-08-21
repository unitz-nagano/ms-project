import { create } from 'zustand'

interface AppState {
  selectedTaskId: string | null
  isSidePanelOpen: boolean
  panelWidth: number // タスクテーブルの幅(px)

  selectTask: (id: string | null) => void
  openSidePanel: (taskId: string) => void
  closeSidePanel: () => void
  setPanelWidth: (width: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedTaskId: null,
  isSidePanelOpen: false,
  panelWidth: 400,

  selectTask: (id) => set({ selectedTaskId: id }),
  openSidePanel: (taskId) => set({ selectedTaskId: taskId, isSidePanelOpen: true }),
  closeSidePanel: () => set({ isSidePanelOpen: false, selectedTaskId: null }),
  setPanelWidth: (width) => set({ panelWidth: width }),
}))
