# AWS CloudWatch MCP サンプルアプリケーション設計書

## 1. 概要

### 1.1 プロジェクト概要
AWS CloudWatch MCP (Model Context Protocol) サンプルアプリケーションは、AWS CloudWatchの監視データをMCPプロトコルを通じてアクセス可能にするリファレンス実装です。Webベースのチャットインターフェースを通じて、自然言語でCloudWatchのメトリクスを取得できます。

### 1.2 目的
- MCPプロトコルの実装例を提供
- AWS CloudWatchとの統合パターンを示す
- リアルタイムチャットインターフェースによるユーザビリティの向上
- 日本語での自然言語処理デモンストレーション

### 1.3 主要機能
- CloudWatchメトリクスの取得
- EC2インスタンスCPU使用率の専用取得
- 利用可能なメトリクス一覧の表示
- リアルタイムWebチャットインターフェース

## 2. システム アーキテクチャ

### 2.1 全体構成図

```
┌─────────────────┐    WebSocket    ┌─────────────────┐    stdio/JSON-RPC    ┌─────────────────┐    AWS SDK    ┌─────────────────┐
│                 │ ────────────── │                 │ ───────────────────── │                 │ ──────────── │                 │
│  Browser        │                │  Express Server │                       │  MCP Server     │               │  AWS CloudWatch │
│  (Chat UI)      │                │  (server.js)    │                       │  (mcp-server.js)│               │  API            │
│                 │ ←────────────── │                 │ ←───────────────────── │                 │ ←──────────── │                 │
└─────────────────┘                └─────────────────┘                       └─────────────────┘               └─────────────────┘
```

### 2.2 アーキテクチャ層

#### フロントエンド層 (public/index.html)
- **技術**: HTML5, CSS3, JavaScript, Socket.IO Client
- **責務**: ユーザーインターフェース、リアルタイム通信

#### Webサーバー層 (server.js)
- **技術**: Express.js, Socket.IO Server
- **責務**: HTTP/WebSocketサーバー、MCPサーバープロセス管理、自然言語解析

#### MCPサーバー層 (mcp-server.js)
- **技術**: Node.js, MCP SDK
- **責務**: MCPプロトコル実装、AWS API呼び出し

#### 外部サービス層
- **技術**: AWS CloudWatch API
- **責務**: メトリクスデータの提供

## 3. データフロー

### 3.1 リクエストフロー

```
1. ユーザー入力 (自然言語)
   ↓
2. WebSocketでExpress serverに送信
   ↓
3. 自然言語解析・コマンド判定
   ↓
4. JSON-RPC リクエスト生成
   ↓
5. MCP serverにstdio経由で送信
   ↓
6. AWS CloudWatch API呼び出し
   ↓
7. レスポンスをJSON-RPCで返却
   ↓
8. データ整形
   ↓
9. WebSocketでクライアントに送信
   ↓
10. UI更新・表示
```

### 3.2 データ形式

#### MCP JSON-RPC リクエスト例
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_ec2_cpu_metrics",
    "arguments": {
      "instanceId": "i-1234567890abcdef0",
      "hours": 2
    }
  }
}
```

#### CloudWatch メトリクスレスポンス例
```json
{
  "result": {
    "content": [
      {
        "type": "text",
        "text": "EC2インスタンス i-1234567890abcdef0 のCPU使用率:\n- 平均: 25.5%\n- 最大: 78.2%"
      }
    ]
  }
}
```

## 4. コンポーネント設計

### 4.1 MCPサーバー (mcp-server.js)

#### クラス構造
```javascript
class CloudWatchMCPServer {
  constructor()
  setupTools()
  start()
  handleGetCloudWatchMetrics(args)
  handleListCloudWatchMetrics(args)
  handleGetEC2CPUMetrics(args)
}
```

#### 提供ツール

##### get_cloudwatch_metrics
- **パラメータ**: namespace, metricName, dimensions, startTime, endTime, statistics
- **戻り値**: メトリクスデータポイント配列
- **用途**: 汎用CloudWatchメトリクス取得

##### list_cloudwatch_metrics
- **パラメータ**: namespace (オプション), metricName (オプション)
- **戻り値**: 利用可能なメトリクス一覧
- **用途**: メトリクス探索・発見

##### get_ec2_cpu_metrics
- **パラメータ**: instanceId, hours
- **戻り値**: CPU使用率統計
- **用途**: EC2専用の簡易CPU監視

### 4.2 Webサーバー (server.js)

#### 主要機能
- **ルーティング**: 静的ファイル配信 (`/`)
- **Socket.IO**: リアルタイム通信管理
- **プロセス管理**: MCPサーバーサブプロセス制御
- **コマンド解析**: 自然言語からMCPリクエスト生成

#### 自然言語コマンド解析
```javascript
const commandPatterns = {
  ec2_cpu: /EC2.*CPU|cpu.*EC2/i,
  list_metrics: /メトリクス.*一覧|一覧.*メトリクス/i,
  tools: /ツール|tool/i,
  instancePattern: /i-[a-f0-9]{17}/,
  hoursPattern: /(\d+)\s*時間/
};
```

### 4.3 フロントエンド (public/index.html)

#### UI コンポーネント
- **チャットエリア**: メッセージ履歴表示
- **入力フィールド**: ユーザー入力受付
- **接続ステータス**: WebSocket接続状態表示
- **クイックボタン**: よく使用するコマンドのショートカット

#### 機能
- **リアルタイム通信**: Socket.IOクライアント
- **メッセージフォーマット**: Markdownサポート
- **レスポンシブデザイン**: モバイル対応
- **日本語サポート**: 全文日本語インターフェース

## 5. AWS統合

### 5.1 認証設定

#### サポートする認証方法
1. **AWS CLI設定**: `aws configure`で設定された認証情報
2. **環境変数**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`
3. **IAMロール**: EC2インスタンス上で実行時の自動認証

#### 必要な権限
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    }
  ]
}
```

### 5.2 CloudWatch API利用

#### メトリクス取得パターン
- **時系列データ**: 指定期間のメトリクス値配列
- **統計データ**: Average, Maximum, Minimum, Sum, SampleCount
- **ディメンション**: AWS リソースの識別子

#### エラーハンドリング
- AWS認証エラー
- リージョン設定エラー
- API制限エラー
- ネットワークエラー

## 6. セキュリティ考慮事項

### 6.1 認証・認可
- AWS認証情報の安全な管理
- 最小権限の原則に基づくIAMポリシー
- 環境変数による設定情報の保護

### 6.2 入力検証
- ユーザー入力の sanitization
- AWS リソースID形式の検証
- パラメータ範囲の制限

### 6.3 通信セキュリティ
- HTTPS対応 (プロダクション環境)
- WebSocket接続の適切な処理
- エラーメッセージでの機密情報漏洩防止

## 7. パフォーマンス

### 7.1 最適化ポイント
- AWS APIの効率的な呼び出し
- メトリクスデータのキャッシュ戦略
- WebSocketの適切な接続管理

### 7.2 制限事項
- CloudWatch APIのレート制限
- メトリクス取得可能期間の制限
- 同時接続数の考慮

## 8. 拡張性

### 8.1 新しいツールの追加
MCPサーバーに新しいツールを追加する手順：

1. `setupTools()` メソッドに新しいツール定義を追加
2. ハンドラーメソッドを実装
3. Webサーバーのコマンド解析パターンを更新
4. フロントエンドにクイックボタンを追加（必要に応じて）

### 8.2 他のAWSサービス対応
- EC2、RDS、ELBなどの他のサービスメトリクス
- AWS Logsとの統合
- AWS Configとの連携

## 9. 運用・保守

### 9.1 ログ出力
- MCPサーバーの標準出力・エラー出力
- Express サーバーのアクセスログ
- AWS API呼び出しログ

### 9.2 監視項目
- アプリケーションの稼働状態
- AWS API呼び出し回数・エラー率
- WebSocket接続数

### 9.3 トラブルシューティング
- AWS認証エラーの診断手順
- ネットワーク接続問題の切り分け
- MCPプロトコル通信の確認方法

## 10. 技術仕様

### 10.1 動作環境
- **Node.js**: 14.x以上
- **NPM**: 6.x以上
- **AWS CLI**: 2.x (オプション)

### 10.2 依存関係
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.4.0",
    "aws-sdk": "^2.1691.0",
    "express": "^4.18.2",
    "socket.io": "^4.7.5"
  }
}
```

### 10.3 ディレクトリ構造
```
aws_mcp_sample/
├── README.md              # プロジェクト説明書
├── package.json           # Node.js依存関係定義
├── package-lock.json      # 依存関係バージョンロック
├── mcp-server.js          # MCPサーバー実装
├── server.js              # Expressサーバー実装
├── public/
│   └── index.html         # Webユーザーインターフェース
└── node_modules/          # Node.js依存関係
```

## 11. 実装の相違点と制限事項

### 11.1 標準MCP実装との主要相違点

このサンプルアプリケーションは、**教育・デモンストレーション目的**のため、標準的なMCP統合とは異なる実装を採用しています。

#### 標準MCPアーキテクチャ
```
生成AI (Claude等) ←→ MCP Server ←→ AWS CloudWatch
```

#### このサンプルのアーキテクチャ
```
Browser ←→ Express Server (AI代替) ←→ MCP Server ←→ AWS CloudWatch
```

### 11.2 生成AI代替実装の詳細

#### **server.js における AI 機能の模擬**

| 本来のAI機能 | サンプルでの代替実装 | ファイル位置 |
|-------------|-------------------|-------------|
| 自然言語理解 | 正規表現パターンマッチング | `server.js:120-227` |
| 意図解釈 | キーワードベースの条件分岐 | `server.js:125-222` |
| パラメータ抽出 | 固定正規表現による抽出 | `server.js:142-146` |
| 動的応答生成 | テンプレート化された固定レスポンス | `mcp-server.js:187-201` |

#### **具体的な代替実装例**

**1. 自然言語解析の代替 (server.js:120-227)**
```javascript
// AI: 文脈理解によるパラメータ抽出
// サンプル: 固定パターンによる文字列マッチング
if (lowerMessage.includes('ec2') && lowerMessage.includes('cpu')) {
  const instanceIdMatch = message.match(/i-[a-zA-Z0-9]+/);
  const hoursMatch = message.match(/(\d+)\s*時間/);
}
```

**2. コマンド認識の代替 (server.js:125-222)**
```javascript
// AI: 意図分類による動的ツール選択
// サンプル: ハードコードされたパターンマッチング
const commandPatterns = {
  ec2_cpu: /EC2.*CPU|cpu.*EC2/i,
  list_metrics: /メトリクス.*一覧|一覧.*メトリクス/i,
  tools: /ツール|tool/i
};
```

**3. レスポンス生成の代替 (mcp-server.js:187-201)**
```javascript
// AI: 動的な自然言語生成
// サンプル: 固定テンプレートによる整形
text: `CloudWatch メトリクス: ${namespace}/${metricName}\n\n` +
      `統計値: ${statistic}\n` +
      `データポイント数: ${result.datapoints.length}\n\n`
```

### 11.3 プロトコル通信の相違点

#### **標準MCP通信**
- AI → MCP Server: 直接的なJSON-RPC 2.0通信
- リアルタイムな双方向通信
- セッション管理とコンテキスト保持

#### **サンプル実装の通信 (server.js:40-75)**
- Express Server → MCP Server: 子プロセス経由のstdio通信
- WebSocket → Express Server: ブラウザとの通信層
- 手動JSON-RPCハンドリング

### 11.4 機能制限事項

#### **欠落している標準MCP機能**

| 標準MCP機能 | サンプルでの対応状況 | 影響 |
|------------|-------------------|-----|
| プロンプトテンプレート | **未実装** | AIコンテキスト設定不可 |
| リソースプロバイダー | **未実装** | AWS リソース探索不可 |
| サンプリング機能 | **未実装** | AI モデル統合不可 |
| 進捗コールバック | **部分実装** | 長時間処理の可視性限定 |
| エラー分類体系 | **簡易実装** | 詳細エラーハンドリング不可 |

#### **自然言語処理の制限**

**対応可能な入力パターン**
- `"EC2のCPU使用率を取得して"`
- `"CloudWatchメトリクス一覧"`
- `"EC2 i-1234567890abcdef0 のCPU 2時間"`

**対応不可能な入力例**
- 同義語・類義語での表現
- 文脈に依存した省略表現
- 複合的な条件指定
- 曖昧な時間表現

### 11.5 拡張時の考慮事項

#### **実際のAI統合への移行**

標準MCP統合に移行する場合の変更点：

1. **server.js の削除/簡素化**
   - WebSocket層の除去
   - 自然言語解析ロジックの削除
   - プロセス管理の簡素化

2. **mcp-server.js の調整**
   - レスポンス形式の構造化
   - エラーハンドリングの拡充
   - リソース・プロンプト機能の追加

3. **通信方式の変更**
   - stdio直接通信への変更
   - MCP SDK クライアントの利用
   - セッション管理の実装

#### **現在の実装での拡張制限**

- **新コマンド追加**: 正規表現パターンの手動追加が必要
- **パラメータ拡張**: 固定解析ロジックの修正が必要
- **多言語対応**: 全パターンの再実装が必要
- **動的応答**: テンプレート修正によるメンテナンス負荷

### 11.6 デモンストレーション価値

このサンプル実装は以下の教育的価値を提供：

- **MCPプロトコルの理解**: 正しいJSON-RPC実装例
- **AWS統合パターン**: CloudWatch API利用方法
- **ツール設計思想**: MCP ツール定義のベストプラクティス
- **アーキテクチャ概念**: 分離された責務と通信層

ただし、**本格的なAI統合を目指す場合は、この実装を参考にしつつ、標準MCPパターンでの再実装を推奨**します。

## 12. 参考資料

- [Model Context Protocol (MCP) 仕様](https://modelcontextprotocol.io/)
- [AWS CloudWatch API リファレンス](https://docs.aws.amazon.com/cloudwatch/)
- [Socket.IO ドキュメント](https://socket.io/docs/)
- [Express.js ガイド](https://expressjs.com/)

---

**作成日**: 2025年7月16日  
**バージョン**: 1.1  
**作成者**: Claude Code AI Assistant