# 実装進捗

最終更新: 2026-08-21

## フェーズ一覧

| # | フェーズ | ステータス |
|---|---|---|
| 0 | 決定事項を潰す | ✅ 完了 |
| 1 | 土台セットアップ | 🔲 未着手 |
| 2 | タスク CRUD | 🔲 未着手 |
| 3 | ガント描画（read-only） | 🔲 未着手 |
| 4 | ガント操作（ドラッグ / リサイズ） | 🔲 未着手 |
| 5 | 依存と親子タスク | 🔲 未着手 |
| 6 | 磨き込み | 🔲 未着手 |

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

## Phase 1 🔲 未着手

**土台セットアップ**

- [ ] `create-next-app`（App Router + TypeScript + Tailwind）
- [ ] shadcn/ui 導入
- [ ] Dexie.js 導入、DB スキーマ定義（`src/lib/db.ts`）
- [ ] Repository interface 定義（`src/repositories/`）
- [ ] DexieTaskRepository 実装
- [ ] Zustand store 初期設定
- [ ] Framer Motion 導入
- [ ] date-fns 導入
- [ ] Vitest 設定
- [ ] `next.config.js` に `output: 'export'` 設定
- [ ] git コミット

---

## Phase 2 🔲 未着手

**タスク CRUD**

- [ ] プロジェクト一覧ページ（`/`）
- [ ] プロジェクト作成・削除
- [ ] タスク一覧表（TanStack Table、カラムリサイズ）
- [ ] タスク CRUD（名前 / 開始日 / 終了日 / 進捗 / 担当者）
- [ ] サイドパネル（タスク詳細・編集、Framer Motion スライドイン）
- [ ] WBS 親子階層（展開・折り畳み、Tab/Shift+Tab インデント）
- [ ] 担当者管理（User CRUD）
- [ ] 担当者カラープリセット自動割当

---

## Phase 3 🔲 未着手

**ガント描画（read-only）**

- [ ] `<GanttView>` 全体レイアウト
- [ ] `<GanttHeader>` 日付軸（日固定）
- [ ] `<GridBackground>` 縦グリッド
- [ ] `<TaskBar>` バー描画（担当者色）
- [ ] `<MilestoneMark>` ダイヤモンド
- [ ] タスクテーブルとガントの縦スクロール同期
- [ ] 左右パネルリサイズ（`<PanelResizer>`）

---

## Phase 4 🔲 未着手

**ガント操作**

- [ ] タスクバー移動（ドラッグで開始日・終了日を変更）
- [ ] タスクバー端リサイズ
- [ ] 日付グリッドスナップ
- [ ] ドラッグ中プレビュー表示

---

## Phase 5 🔲 未着手

**依存と親子タスク**

- [ ] `<DependencyArrow>` elbow 型折れ線描画
- [ ] 依存関係の CRUD（FS のみ）
- [ ] 循環依存検出（トポロジカルソート）
- [ ] WBS の折り畳み時に子タスクの依存矢印を非表示

---

## Phase 6 🔲 未着手

**磨き込み**

- [ ] 進捗バー（タスクバー内に %表示）
- [ ] キーボードショートカット
- [ ] エラーハンドリング（Dexie 操作）
- [ ] タイムゾーン UTC 保存 / ローカル表示
- [ ] Cloudflare Pages デプロイ設定・動作確認
- [ ] パフォーマンス確認（タスク数が増えたときの SVG 描画）

---

## ステータス凡例

| 記号 | 意味 |
|---|---|
| ✅ | 完了 |
| 🚧 | 進行中 |
| 🔲 | 未着手 |
| ❌ | ブロック中 |
