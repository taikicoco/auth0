# Frontend (Next.js with Auth0)

Auth0認証を実装したNext.jsアプリケーションです。

## src/ ディレクトリ構成

### app/ (App Router)

#### `layout.tsx`
- アプリケーション全体のルートレイアウト
- Auth0の`UserProvider`でアプリ全体をラップ
- 認証状態を全コンポーネントで利用可能にする

#### `page.tsx`
- メインページコンポーネント
- `useUser`フックを使用してAuth0の認証状態を管理
- 認証状態に応じたUI表示:
  - 未認証: ログインリンク表示
  - 認証済み: ユーザー情報とログアウトリンク表示
- API呼び出しの実装:
  - **公開API**: `http://localhost:8080/public` (認証不要)
  - **保護されたAPI**: アクセストークンを取得してから`http://localhost:8080/protected/profile`を呼び出し

#### api/auth/ (認証API)

##### `[...auth0]/route.ts`
- Auth0の全認証エンドポイントを処理するキャッチオールルート
- `handleAuth()`を使用して以下のエンドポイントを自動処理:
  - `/api/auth/login` - ログインフロー開始
  - `/api/auth/logout` - ログアウト処理
  - `/api/auth/callback` - Auth0認証後のコールバック
  - `/api/auth/me` - 現在のユーザー情報取得

##### token/`route.ts`
- 認証済みユーザーのアクセストークン取得用カスタムAPI
- `getAccessToken`を使用してサーバーサイドでトークンを取得
- クライアントサイドからのAPI呼び出し用のトークンを提供
- エラーハンドリング付き（401/500ステータスコード）

## 認証フロー

1. **ユーザー認証**:
   - ユーザーが`/api/auth/login`にアクセス
   - Auth0のホスト型ログインページにリダイレクト
   - 認証後`/api/auth/callback`に戻る
   - `UserProvider`が認証状態を管理

2. **API連携**:
   - 公開API: 直接フェッチ（認証不要）
   - 保護されたAPI: 
     1. `/api/auth/token`でアクセストークン取得
     2. AuthorizationヘッダーでバックエンドAPI呼び出し

## 主要機能

- Auth0によるセキュアな認証
- シームレスなログイン/ログアウト体験
- 認証状態に応じたリアルタイムUI更新
- 公開/保護されたAPIの明確な分離
- ローディング状態とエラーハンドリング

## 開発サーバー起動

```bash
npm run dev
# または
yarn dev
# または
pnpm dev
# または
bun dev
```

[http://localhost:3000](http://localhost:3000)でアプリケーションにアクセスできます。
