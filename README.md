# LAMIXボット

## 概要

LAMIXボットは、ユーザーがコーディングなしでカスタマイズされたGPTを作成できるアプリです。日本のブロガーをターゲットにしており、ユーザーは自身のブログやウェブサイトにカスタムチャットボットを埋め込むことができます。LAMIXボットには、クイズ形式と伝統的なチャット形式の2種類のデザインがあります。クイズ形式では、ユーザーが提示された選択肢から回答をクリックするスタイルです。伝統的なチャット形式では、ユーザーがナレッジベースに質問を行うことができます。アプリは日本語のダッシュボードを含んでいます。
https://lamix.hatoltd.com/

## 特徴

- カスタマイズ可能なGPTを簡単に作成
- ブログやウェブサイトに埋め込み可能
- クイズ形式とチャット形式の2つのデザイン
- 日本語対応のダッシュボード

## 環境変数

以下の環境変数を設定する必要があります。

- `MONGODB_URI` - MongoDBの接続URI
- `MONGODB_NAME` - MongoDBのデータベース名
- `OPENAI_API_KEY` - OpenAIのAPIキー
- `MODE` - 動作モード（`local` または `online`）
- `JWT_SECRET` - JWTのシークレットキー
- `AWS_ACCESS_KEY_ID` - AWSのアクセスキーID
- `AWS_SECRET_ACCESS_KEY` - AWSのシークレットアクセスキー
- `AWS_REGION` - AWSのリージョン
- `AWS_S3_BUCKET_NAME` - AWS S3のバケット名

## インストール

1. リポジトリをクローンします。
   ```sh
   git clone https://github.com/brocketdesign/Japanese-Custom-GPT
   cd Japanese-Custom-GPT
   ```

2. 必要なパッケージをインストールします。
   ```sh
   npm install
   ```

3. `.env`ファイルを作成し、必要な環境変数を設定します。
   ```env
   MONGODB_URI=your_mongodb_uri
   MONGODB_NAME=your_mongodb_name
   OPENAI_API_KEY=your_openai_api_key
   MODE=local_or_online
   JWT_SECRET=your_jwt_secret
   AWS_ACCESS_KEY_ID=your_aws_access_key_id
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   AWS_REGION=your_aws_region
   AWS_S3_BUCKET_NAME=your_s3_bucket_name
   ```

## 使用方法

1. アプリを起動します。
   ```sh
   npm start
   ```

2. ブラウザで以下のURLにアクセスします。
   ```
   http://localhost:3000
   ```

3. ダッシュボードからカスタムチャットボットを作成・管理します。

## ライセンス

このプロジェクトはISCライセンスの下で公開されています。

## 著者

- 合同会社はと

## 依存関係

- Node.js
- Fastify
- MongoDB
- AWS SDK
- OpenAI API
- その他詳細は`package.json`を参照してください。

## スクリプト

- `start`: アプリケーションを起動します。
- `test`: テストスクリプト（未実装）。

```
