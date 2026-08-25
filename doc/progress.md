# 実装進捗

最終更新: 2026-08-25（Phase 6 完了）

## フェーズ一覧

| # | フェーズ | ステータス |
|---|---|---|
| 0 | 決定事項を潰す | ✅ 完了 |
| 1 | 土台セットアップ | ✅ 完了 |
| 2 | タスク CRUD | ✅ 完了 |
| 3 | ガント描画（read-only） | ✅ 完了 |
| 4 | ガント操作（ドラッグ / リサイズ） | ✅ 完了 |
| 5 | 依存と親子タスク | ✅ 完了 |
| 6 | 磨き込み | ✅ 完了 |

---

## Phase 0 ✅ 完了

**決定事項を潰す**

- [x] ガント描画方式 → 自作 SVG
- [x] UI ライブラリ → shadcn/ui + Tailwind CSS
- [x] 認証 → 後回し（Cloudflare Basic Auth）
- [x] ストレージ → IndexedDB + Dexie.js（Repository pattern）
- [x] 状態管理 → Zustand（TanStack Query 不要）
- [x] テーブル → TanStack Table
- [x] ドラッグ → 自作 pointer events
- [x] アニメーション → Framer Motion
- [x] 日付計算 → date-fns
- [x] デプロイ → Cloudflare Pages（静的エクスポート）
- [x] 依存矢印 → elbow 型折れ線
- [x] タスク詳細 → サイドパネル
- [x] WBS インデント → Tab/Shift+Tab
- [x] 担当者カラー → プリセット自動割当

---

## Phase 1 ✅ 完了

**土台セットアップ**

- [x] `create-next-app`（App Router + TypeScript + Tailwind）
- [x] shadcn/ui 導入
- [x] Dexie.js 導入、DB スキーマ定義（`src/lib/db.ts`）
- [x] Repository interface 定義（`src/repositories/types.ts`）
- [x] DexieProjectRepository / DexieTaskRepository / DexieUserRepository 実装
- [x] Zustand store 初期設定（`src/store/useAppStore.ts`）
- [x] Framer Motion 導入
- [x] date-fns 導入
- [x] Vitest 設定
- [x] `next.config.ts` 基本設定
- [x] git コミット

---

## Phase 2 ✅ 完了

**タスク CRUD**

- [x] プロジェクト一覧ページ（`/`）
- [x] プロジェクト作成・削除
- [x] タスク一覧表（TanStack Table、カラムリサイズ）
- [x] タスク CRUD（名前 / 開始日 / 終了日 / 進捗 / 担当者）
- [x] サイドパネル（タスク詳細・編集、Framer Motion スライドイン）
- [x] WBS 親子階層（展開・折り畳み、Tab/Shift+Tab インデント）
- [x] 担当者管理（User CRUD）
- [x] 担当者カラープリセット自動割当

---

## Phase 3 ✅ 完了

**ガント描画（read-only）**

- [x] `<GanttView>` 全体レイアウト（`src/components/gantt/GanttView.tsx`）
- [x] `<GanttHeader>` 日付軸（月・日 2段、sticky で縦スクロール追従）
- [x] `<GridBackground>` 縦グリッド・週末背景
- [x] `<TaskBar>` バー描画（担当者色、進捗オーバーレイ）
- [x] `<MilestoneMark>` ダイヤモンド（isMilestone フラグ）
- [x] 今日線（青い点線）
- [x] タスクテーブルとガントの縦スクロール同期
- [x] 左右パネルリサイズ（ドラッグハンドル、300〜900px）

---

## Phase 4 ✅ 完了

**ガント操作**

- [x] タスクバー移動（ドラッグで開始日・終了日を変更）
- [x] タスクバー端リサイズ（左端・右端の個別リサイズ）
- [x] 日付グリッドスナップ（DAY_W 単位で Math.round）
- [x] ドラッグ中プレビュー表示（opacity 0.7 + preview state でリアルタイム反映）

---

## Phase 5 ✅ 完了

**依存と親子タスク**

- [x] `<DependencyArrow>` elbow 型折れ線描画（`GanttView.tsx` 内 SVG path）
- [x] 依存関係の CRUD（FS のみ）（`DexieDependencyRepository.ts` + サイドパネル UI）
- [x] 循環依存検出（DFS、`hasCycle` in `task-tree.ts`）
- [x] WBS の折り畳み時に子タスクの依存矢印を非表示（visibleTasks フィルタで自動）

---

## Phase 6 ✅ 完了

**磨き込み**

- [x] 進捗バー（タスクバー内に %表示、barW >= 40px のときのみ）
- [x] キーボードショートカット（Esc でサイドパネルを閉じる）
- [x] エラーハンドリング（taskRepository の save/delete を try-catch 化）
- [x] タイムゾーン UTC 保存 / ローカル表示（YYYY-MM-DD 形式で TZ 非依存、対応済み）
- [x] Cloudflare Pages デプロイ設定（`output: 'export'` + `trailingSlash: true`）
- [x] パフォーマンス確認（useMemo で days/months/rowIndexMap を最適化済み）

---

## ステータス凡例

| 記号 | 意味 |
|---|---|
| ✅ | 完了 |
| 🚧 | 進行中 |
| 🔲 | 未着手 |
| ❌ | ブロック中 |
