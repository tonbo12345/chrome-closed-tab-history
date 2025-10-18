# CLAUDE.md

このファイルはClaude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

# Chrome拡張機能: 閉じたタブ履歴

閉じたブラウザタブを追跡・復元するChrome拡張機能。検索、ページネーション、カスタマイズ可能な設定を備えています。

## アーキテクチャ

### コアコンポーネント

**background.js** - Service Worker
- タブのライフサイクルイベント（onCreated, onUpdated, onRemoved）を追跡
- タブ情報を`recentTabs` Map に保存（最大200エントリ）
- 複数タブ同時閉鎖時の競合状態をPromiseキューで処理
- 閉じたタブ履歴をchrome.storage.localに保存（最大1000件）
- chrome:// URLや空タブをフィルタリング

**popup.html/js/css** - ユーザーインターフェース
- 閉じたタブ履歴を新しい順に表示
- 検索機能（タイトルのみ、部分一致）
- ページネーション（Previous/Nextボタン）
- 設定: ページあたりの表示件数（10/20/30）
- 固定サイズ: 450×600px

### データフロー

1. タブ作成 → `recentTabs.set(tabId, tabInfo)` 即座に保存
2. タブ更新 → 保存済みタブ情報を更新（URL、タイトル、favicon）
3. タブ削除 → 保存操作をキューに追加 → chrome.storage.local
4. ポップアップ開く → ストレージから読み込み → ページネーションで表示

### 重要な実装詳細

**競合状態の防止**: 複数タブが同時に閉じられた場合、Promiseキュー（`saveQueue`）を使用してストレージへの書き込みをシリアル化し、データ損失を防止。

**タブ追跡戦略**: タブ作成時（ロード完了を待たずに）に情報を保存することで、素早く閉じられるタブや一括で閉じられるタブ（例:「右側のタブを閉じる」）もキャプチャ。

## 開発

### 拡張機能のテスト

```bash
# Chromeで拡張機能を読み込む
1. chrome://extensions/ を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このディレクトリ (C:\work\ChromExtensions) を選択

# 変更後のリロード
chrome://extensions/ でリロードアイコンをクリック
```

### Playwrightによる自動テスト

```bash
# 基本的な拡張機能テスト
node tests/test-extension.js

# 複数タブ同時閉鎖のテスト
node tests/test-multiple-tabs-close.js

# ストレージとページネーションの検証
node tests/verify-multiple-close.js

# background.jsの動作診断
node tests/diagnose-background.js

# 表示件数設定のテスト
node tests/test-display-count.js
```

すべてのテストスクリプト:
- 拡張機能を読み込んだ状態でChromeを起動
- 手動検証のため30-90秒間ブラウザを開いたまま維持
- `headless: false`で動作を観察可能
- テスト用タブを自動作成・閉鎖

### デバッグ

**Service Worker Console**:
```
chrome://extensions/ → 「Service Worker」リンクをクリック
```

**ストレージの確認**:
```javascript
// Service Workerコンソールで実行
chrome.storage.local.get(['closedTabs'], r => console.log(r.closedTabs))
console.log('recentTabs:', Array.from(recentTabs.entries()))
```

**Popup DevTools**:
```
ポップアップを右クリック → 検証
```

### アイコン生成

アイコンは`icons/`に配置（16, 32, 48, 128px）。再生成するには:

```bash
# ブラウザでアイコン変換ツールを開く
start tools/update-icons.html

# ソースSVGは icons/source-icon.svg にあります
```

## プロジェクト構造

```
.
├── manifest.json          # Chrome拡張機能マニフェスト (MV3)
├── background.js          # Service Worker（タブ追跡）
├── popup.html/js/css      # 拡張機能ポップアップUI
├── icons/                 # 拡張機能アイコン（全サイズ）
│   ├── icon16.png         # 16×16 ツールバーアイコン
│   ├── icon32.png         # 32×32 ツールバーアイコン（高DPI）
│   ├── icon48.png         # 48×48 拡張機能管理ページ
│   ├── icon128.png        # 128×128 Chrome Web Store
│   └── source-icon.svg    # アイコン生成用ソースSVG
├── screenshots/           # Chrome Web Store用スクリーンショット
│   └── original-screenshot.png
├── tests/                 # Playwrightテストスクリプト
├── tools/                 # HTMLベースの変換ツール
│   ├── resize-screenshot.html     # スクリーンショットリサイズツール
│   ├── update-icons.html          # SVG→PNG変換ツール
│   └── convert-svg-to-png.html
└── closed-tab-history.zip # Chrome Web Store提出用パッケージ
```

### Chrome Web Store提出用パッケージ (closed-tab-history.zip)

**含まれるファイル:**
```
closed-tab-history.zip (11.1 KB)
├── manifest.json          # 674 bytes
├── background.js          # 5.6 KB
├── popup.html             # 2.0 KB
├── popup.js               # 8.5 KB
├── popup.css              # 5.3 KB
└── icons/
    ├── icon16.png         # 300 bytes
    ├── icon32.png         # 461 bytes
    ├── icon48.png         # 654 bytes
    ├── icon128.png        # 1.8 KB
    └── source-icon.svg    # 170 bytes
```

**除外されるファイル:**
- `tests/` - 開発用テストスクリプト
- `tools/` - 開発用ツール
- `screenshots/` - ストアリスティング用アセット
- `.git/` - バージョン管理
- `CLAUDE.md`, `README.md` - ドキュメント
- `node_modules/` - 依存関係

## バージョン管理

### セマンティックバージョニング (MAJOR.MINOR.PATCH)

**現在のバージョン:** 1.0.2

**バージョン繰り上げルール:**

1. **MAJOR (X.0.0)** - 破壊的変更
   - ストレージ形式の変更（後方互換性なし）
   - 主要機能の削除
   - UIの全面刷新

2. **MINOR (1.X.0)** - 新機能追加
   - 新しい機能の追加（検索機能、エクスポート機能など）
   - 設定項目の追加
   - UIの大幅な改善

3. **PATCH (1.0.X)** - バグ修正・小規模改善
   - バグ修正
   - パフォーマンス改善
   - 小規模なUI調整
   - ドキュメント更新

**バージョン更新時の必須作業:**

1. `manifest.json` の `version` フィールドを更新
2. `popup.html` の Settings内バージョン表示を更新（46行目）
3. 変更をコミット・プッシュ
4. Chrome Web Storeに新バージョンを提出

**バージョン履歴:**

- **1.0.2** - タブ追跡改善（onActivatedリスナー追加）、バージョン表示を1箇所に統一
- **1.0.1** - 初回リリース後の修正
- **1.0.0** - 初回リリース

## 仕様

- **最大履歴**: 1000件の閉じたタブ
- **ストレージ**: chrome.storage.local（永続）
- **表示**: ページあたり10/20/30件（設定可能）
- **検索**: タイトルの部分一致のみ
- **除外**: chrome:// URL、about:blank、空のURL
- **言語**: 英語UI
- **バージョン表示**: Settings内に1箇所のみ（popup.html 46行目）

## 既知の動作

- ウィンドウ閉鎖時に閉じられたタブは追跡されない（`isWindowClosing`チェック）
- 新しいタブページ（chrome://newtab/）はフィルタリングされる
- 100ms未満で閉じられる複数タブはキューで正しく処理される
- 検索または表示件数変更時にページネーションは1ページ目にリセット
