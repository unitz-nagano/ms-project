# MS Project 代替 Web アプリ設計プラン 🗓️

## 課題と方針

上司から「MS Project でガントチャート引け」と言われたけど Mac だと詰むし UI がクソなので **Web ベースの MS Project 代替（ガントチャート中心のプロジェクト管理ツール）** を自作する
個人開発スタート想定。まずは MVP を最短で動かして、じわじわ拡張

## スコープ整理

### MVP（絶対入れる）

- プロジェクトを 1 つ作れる
- タスク CRUD（名前 / 開始日 / 終了日 / 進捗 % / 担当者）
- 親子タスク（WBS 階層）、展開・折り畳みあり、Tab/Shift+Tab でインデント操作
- タスク間の依存（FS のみ）
- ガントチャート表示（横軸=日固定、縦軸=タスク、バー描画、依存線）
- タスクバーをドラッグして日程変更 / 端でリサイズ（自作 pointer events）
- マイルストーン（duration=0）
- 左右パネルリサイズ（タスクテーブル | ガント）
- タスク詳細サイドパネル（Framer Motion スライドイン）
- 担当者ごとにタスクバー色分け（プリセット自動割当）
- 依存矢印は折れ線（elbow 型）

### v2（あとで）

- クリティカルパス自動計算
- 依存タイプ 4 種類（FS/SS/FF/SF）+ ラグ
- ガント日付軸の粒度切替（月/週/日）
- リソース管理（人ごとの稼働率）
- カレンダー（休日/営業日）反映
- CSV / MS Project XML インポート・エクスポート
- WBS ドラッグ＆ドロップで並び替え・階層変更
- 担当者カラー手動変更
- Storybook
- 複数プロジェクト、ユーザー認証、共同編集
- DB（Prisma + Postgres）への移行

### やらない

- リアルタイム同時編集（Yjs 系）はスコープ外
- ネイティブアプリ化
- モバイル最適化（PC 前提でおk）

## 技術スタック（確定）

| レイヤ | 採用 | 理由 |
| --- | --- | --- |
| フレームワーク | **Next.js (App Router) + TypeScript** | 慣れてる |
| UI ライブラリ | **shadcn/ui + Tailwind CSS** | 軽い・慣れてる |
| ガント描画 | **自作 SVG** | 高機能化に対応できる |
| アニメーション | **Framer Motion** | サイドパネル等。ドラッグには不使用 |
| ドラッグ | **自作 pointer events** | 日付グリッドスナップ等の細かい制御 |
| 状態管理 | **Zustand** | IndexedDB 完結なので TanStack Query 不要 |
| テーブル | **TanStack Table** | カラムリサイズ機能ビルトイン |
| ストレージ | **IndexedDB + Dexie.js** | ブラウザ完結。Repository pattern で将来の DB 移行に備える |
| 日付計算 | **date-fns** | 統一 |
| バリデーション | **Zod** | フォーム & 型安全 |
| テスト | **Vitest（ユニットテストのみ）** | ガントロジック・日付計算を優先 |
| デプロイ | **Cloudflare Pages（静的エクスポート）** | 帯域無制限・商用利用可 |
| 認証 | **後回し**（Cloudflare Basic Auth で塞ぐ） | MVP 優先 |

## 設計方針

### Repository Pattern

IndexedDB → 将来の API/DB 切り替えに備え、`interface` だけ定義してシンプルに差し替えられるようにする

```ts
interface TaskRepository {
  findAll(projectId: string): Promise<Task[]>
  findById(id: string): Promise<Task | null>
  create(task: CreateTaskInput): Promise<Task>
  update(id: string, task: UpdateTaskInput): Promise<Task>
  delete(id: string): Promise<void>
}

// IndexedDB実装（MVP）
class DexieTaskRepository implements TaskRepository { ... }

// 将来の実装（v2以降）
class ApiTaskRepository implements TaskRepository { ... }
```

## データモデル（Dexie スケッチ）

```ts
// db.ts
import Dexie, { type Table } from 'dexie'

export interface Project {
  id: string
  name: string
  startDate: string // ISO文字列、UTC保存
  endDate?: string
  createdAt: string
}

export interface Task {
  id: string
  projectId: string
  parentId?: string
  name: string
  startDate: string
  endDate: string
  progress: number   // 0-100
  isMilestone: boolean
  order: number
  assigneeId?: string
  isExpanded?: boolean
}

export interface Dependency {
  id: string
  predecessorId: string
  successorId: string
  type: 'FS'   // MVPはFSのみ
  lag: number
}

export interface User {
  id: string
  name: string
  color: string  // プリセットカラー自動割当
}

export class AppDB extends Dexie {
  projects!: Table<Project>
  tasks!: Table<Task>
  dependencies!: Table<Dependency>
  users!: Table<User>

  constructor() {
    super('gantt-app')
    this.version(1).stores({
      projects: 'id, createdAt',
      tasks: 'id, projectId, parentId, order',
      dependencies: 'id, predecessorId, successorId',
      users: 'id',
    })
  }
}
```

## 画面構成（MVP）

- `/` プロジェクト一覧
- `/projects/[id]` メイン画面（左: タスクツリー表、右: ガントチャート、上: ツールバー）
- タスク詳細はサイドパネル（右からスライドイン）

### ガントチャート UI コンポーネント分割案

```
<GanttView>
  ├─ <GanttHeader />         // 日付軸（日固定）
  ├─ <PanelResizer />        // 左右パネルリサイズハンドル
  ├─ <TaskTable />           // 左側の表（TanStack Table、カラムリサイズ）
  └─ <GanttTimeline>         // 右側のバーエリア
       ├─ <GridBackground /> // 縦の日付グリッド
       ├─ <TaskBar />        // タスクバー（ドラッグ/リサイズ、担当者色）
       ├─ <DependencyArrow />// 依存の矢印（elbow型折れ線）
       └─ <MilestoneMark />  // ダイヤモンド
<TaskDetailPanel />          // サイドパネル（Framer Motion）
```

## 実装フェーズ

- **Phase 0: ✅ 完了** 決定事項を潰す
- **Phase 1: 土台**（Next.js + shadcn + Dexie + Zustand セットアップ、Repository interface 定義）
- **Phase 2: タスク CRUD**（表形式で先に作る、WBS 階層、サイドパネル）
- **Phase 3: ガント描画**（read-only、SVG、担当者色）
- **Phase 4: ガント操作**（ドラッグ移動 / リサイズ、パネルリサイズ）
- **Phase 5: 依存と親子タスク**（elbow 矢印、循環検出）
- **Phase 6: 磨き込み**（進捗、マイルストーン、キーボード操作）

## メモ

- **タイムゾーン** は UTC 保存 / 表示で local に変換
- **依存の循環検出** はタスク保存時にクライアントでチェック（トポロジカルソート）
- **デプロイ** は `next.config.js` に `output: 'export'` + `images: { unoptimized: true }`
