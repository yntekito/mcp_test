# AWS MCP Sample

AWS CloudWatchメトリクスを取得できるMCP（Model Context Protocol）サーバーとチャットインターフェースのサンプルです。

## 概要

このサンプルは以下の機能を提供します：

- **AWS CloudWatchメトリクス取得**: EC2、RDSなどのAWSサービスのメトリクスを取得
- **自然言語インターフェース**: チャットでAWSメトリクスを簡単に取得
- **リアルタイム通信**: WebSocketを使用したリアルタイムチャット
- **MCP標準対応**: Model Context Protocolに準拠したサーバー実装

## ファイル構成

```
aws_mcp_sample/
├── package.json              # 依存関係とスクリプト
├── server.js                 # Webサーバーとチャットインターフェース
├── mcp-server.js             # MCP標準サーバー実装
├── public/
│   └── index.html           # チャットUI
└── README.md                # このファイル
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. AWS認証情報の設定

AWS CLIまたは環境変数でAWS認証情報を設定してください：

```bash
# AWS CLI設定
aws configure

# または環境変数
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

### 3. サーバーの起動

```bash
npm start
```

または開発モード（自動再読み込み）：

```bash
npm run dev
```

### 4. ブラウザでアクセス

http://localhost:3000 にアクセスしてチャットインターフェースを使用します。

## 使用方法

### チャットコマンド例

1. **EC2のCPU使用率を取得**
   ```
   EC2のCPU使用率を取得して
   EC2 i-1234567890abcdef0 のCPU 2時間
   ```

2. **CloudWatchメトリクス一覧**
   ```
   CloudWatchメトリクス一覧
   AWS/EC2 メトリクス一覧
   ```

3. **特定のCloudWatchメトリクス**
   ```
   CloudWatch AWS/EC2 CPUUtilization メトリクス
   ```

4. **利用可能なツール**
   ```
   利用可能なツール
   help
   ```

### MCP標準ツール

MCPサーバーは以下のツールを提供します：

1. **get_cloudwatch_metrics**: 指定されたCloudWatchメトリクスを取得
2. **list_cloudwatch_metrics**: 利用可能なCloudWatchメトリクスを一覧表示
3. **get_ec2_cpu_metrics**: EC2インスタンスのCPU使用率を取得

## 直接MCPサーバーを使用

MCPサーバーを直接使用する場合：

```bash
node mcp-server.js
```

MCPクライアントから標準入力でリクエストを送信：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

## AWS権限要件

以下のAWS権限が必要です：

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

## カスタマイズ

### 新しいメトリクスの追加

`mcp-server.js`の`setupToolHandlers()`メソッドに新しいツールを追加できます：

```javascript
{
  name: "get_rds_metrics",
  description: "RDSメトリクスを取得",
  inputSchema: {
    // スキーマ定義
  }
}
```

### チャットコマンドの追加

`server.js`の`parseAndExecuteCommand()`関数に新しいコマンドパターンを追加できます：

```javascript
if (lowerMessage.includes('rds')) {
  // RDS関連の処理
}
```

## トラブルシューティング

### 1. AWS認証エラー

```
Error: Missing credentials in config
```

AWS認証情報が正しく設定されているか確認してください。

### 2. MCPサーバーが起動しない

```
MCP Server exited with code 1
```

Node.jsのバージョンとES6モジュールのサポートを確認してください。

### 3. メトリクスが取得できない

- EC2インスタンスIDが正しいか確認
- CloudWatchメトリクスが有効になっているか確認
- 適切なAWS権限があるか確認

## 技術詳細

### アーキテクチャ

```
Browser (Chat UI)
    ↓ (WebSocket)
Express Server
    ↓ (stdio)
MCP Server
    ↓ (AWS SDK)
AWS CloudWatch
```

### 通信フロー

1. ユーザーがチャットでメッセージを送信
2. Express serverが自然言語を解析
3. 適切なMCPリクエストを生成
4. MCPサーバーがAWS APIを呼び出し
5. 結果をチャットUIに表示

## ライセンス

このサンプルはMITライセンスの下で提供されています。