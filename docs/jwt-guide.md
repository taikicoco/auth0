# JWTの仕組みガイド

このドキュメントは、このリポジトリ（Next.js + Go + Auth0）で使われている **JWT（JSON Web Token）** の仕組みを、図を使って解説するものです。「JWTとは何か」から、「このプロジェクトの中で実際にどう発行され、どう検証されているか」までを追います。

対応する実装コード:

- 発行・保存: `frontend/src/app/api/auth/[...auth0]/route.ts`, `frontend/src/app/api/auth/token/route.ts`
- 検証: `backend/main.go`

---

## 1. JWTとは何か

JWT（JSON Web Token, RFC 7519）は、**署名付きでデータをやり取りするためのトークンのフォーマット**です。OAuth/OIDCの手続き（前回の会話で扱った認可コードフローなど）の「結果として手に入るモノ」がJWTだと考えると位置付けが分かりやすいです。

特徴:

- 中身（誰が発行したか、いつまで有効か等）を**改ざんされていないと検証できる**
- 署名検証さえできれば、**発行元（Auth0）に毎回問い合わせなくても正当性を確認できる**（自己完結型）
- Base64URLエンコードされているだけなので、**中身は暗号化されておらず誰でも読める**（秘密情報を入れてはいけない）

---

## 2. JWTの構造

JWTは `.`（ドット）区切りの3つの部分から成ります。

```
Header.Payload.Signature
```

```mermaid
graph LR
    subgraph HeaderBlock["① Header"]
        H["alg: RS256<br/>typ: JWT<br/>kid: key-id"]
    end
    subgraph PayloadBlock["② Payload"]
        P["iss: https://domain/<br/>aud: api-identifier<br/>sub: auth0|user-id<br/>scope: read:profile<br/>exp: 1700000000"]
    end
    subgraph SigBlock["③ Signature"]
        S["RSASHA256(<br/>base64url(Header) + '.' +<br/>base64url(Payload),<br/>秘密鍵<br/>)"]
    end
    HeaderBlock -- "." --> PayloadBlock
    PayloadBlock -- "." --> SigBlock
```

| パート | 中身 | 役割 |
|---|---|---|
| **Header** | アルゴリズム(`alg`)、鍵ID(`kid`) | どの鍵・アルゴリズムで検証すればよいかを伝える |
| **Payload** | クレーム(`iss`, `aud`, `sub`, `exp`, `scope`など) | 実際のデータ本体 |
| **Signature** | Header+PayloadをHeaderで指定した鍵で署名したバイト列 | 改ざん検知のための署名 |

Header・PayloadはそれぞれBase64URLエンコードされているだけの**平文**です。Signatureだけが「改ざんされていないこと」を保証します。

---

## 3. 署名の仕組み（非対称暗号）

このプロジェクトはHeaderの`alg`が`RS256`、つまり**RSA非対称鍵ペア**で署名しています。「発行する側（Auth0）」と「検証する側（Go API）」で使う鍵が違うのがポイントです。

```mermaid
graph LR
    subgraph Auth0側["Auth0（発行者）"]
        PK["🔒 秘密鍵<br/>(非公開)"] -->|"署名 (sign)"| JWT["JWTトークン"]
        PUB["🔑 公開鍵"] -->|公開| JWKS["/.well-known/jwks.json"]
    end

    JWT -->|"Authorization: Bearer <token>"| REQ["Go APIへのリクエスト"]

    subgraph GoAPI側["Go API（検証者）"]
        REQ --> VERIFY["署名検証"]
        JWKS -->|"公開鍵を取得"| VERIFY
        VERIFY --> RESULT{"署名は正しいか?"}
        RESULT -->|一致| OK["✓ 正当なトークン"]
        RESULT -->|不一致| NG["✗ 改ざん・偽造"]
    end
```

- **秘密鍵はAuth0だけが持つ** → Go API側は絶対に秘密鍵を持たない
- Go APIは **JWKS（JSON Web Key Set）** という公開鍵の集合をAuth0のエンドポイントから取得して検証に使う
- 公開鍵は「配っても安全」な性質を持つため、これで署名の正当性だけを確認できる（Go側から新しいトークンを偽造することはできない）

`backend/main.go` では `jwks.NewCachingProvider` がこのJWKS取得とキャッシュ（5分間）を担当しています。

---

## 4. このリポジトリでのデータフロー全体

ログインからAPI呼び出しまで、JWTがどう受け渡しされるかを追った全体図です。

```mermaid
sequenceDiagram
    participant Browser as ブラウザ
    participant NextJS as Next.js (セッション管理)
    participant Auth0
    participant GoAPI as Go API

    Browser->>NextJS: ① ログイン要求
    NextJS->>Auth0: ② 認可コードフロー (PKCE)
    Auth0-->>NextJS: ③ IDトークン + アクセストークン(JWT)発行
    NextJS->>NextJS: ④ 暗号化してセッションCookieに保存
    Browser->>NextJS: ⑤ GET /api/auth/token
    NextJS-->>Browser: ⑥ アクセストークン(JWT)を返却
    Browser->>GoAPI: ⑦ Authorization: Bearer <JWT>
    GoAPI->>Auth0: ⑧ JWKS取得（キャッシュ切れ時のみ）
    Auth0-->>GoAPI: ⑨ 公開鍵セット
    GoAPI->>GoAPI: ⑩ 署名 / exp / iss / aud を検証
    GoAPI-->>Browser: ⑪ 200 OK + 保護されたリソース
```

ポイント:

- JWT自体は **Next.jsのセッションCookie（暗号化済み）の中に保管**されている（`AUTH0_SECRET`で暗号化）。ブラウザのJSから直接読めるわけではない
- ブラウザは`/api/auth/token`を経由して初めてアクセストークンの生の値を取得する
- Go APIはトークンを**一度も保存しない**。リクエストごとに検証するだけのステートレスな仕組み

---

## 5. Go APIでの検証処理（詳細）

`backend/main.go` の `jwtMiddleware` が実際にやっている処理をフローチャートにしたものです。

```mermaid
flowchart TD
    A[リクエスト受信] --> B{Authorizationヘッダーに<br/>Bearer トークンあり?}
    B -- なし --> Z1[401 Unauthorized]
    B -- あり --> C{JWKSキャッシュは有効?}
    C -- 有効 --> D[キャッシュから公開鍵取得]
    C -- 無効/未取得 --> E[Auth0のJWKSエンドポイントへリクエスト]
    E --> F["公開鍵を5分間キャッシュ"]
    D --> G["RS256で署名検証"]
    F --> G
    G --> H{"exp(期限) / iss(発行者) /<br/>aud(対象者) を検証"}
    H -- 失敗 --> Z2[401 Unauthorized]
    H -- 成功 --> I[claimsをコンテキストに保存]
    I --> J["200 OK + レスポンス<br/>(/protected/profile)"]
```

対応コード（`backend/main.go`）:

```go
func jwtMiddleware(jwtValidator *validator.Validator) echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            token := extractToken(c.Request())         // Bearer抽出
            if token == "" {
                return echo.NewHTTPError(http.StatusUnauthorized, "missing or invalid token")
            }
            claims, err := jwtValidator.ValidateToken(context.Background(), token) // 署名+claims検証
            if err != nil {
                return echo.NewHTTPError(http.StatusUnauthorized, fmt.Sprintf("invalid token: %v", err))
            }
            c.Set(userContextKey, claims)               // コンテキストに保存
            return next(c)
        }
    }
}
```

---

## 6. クレーム（Payload）の読み方

このプロジェクトで実際にやり取りされるアクセストークンのクレーム例:

```json
{
  "iss": "https://your-domain.auth0.com/",
  "aud": "https://your-api-identifier",
  "sub": "auth0|64f1a2b3c4d5e6f7",
  "scope": "read:profile",
  "exp": 1640995200,
  "iat": 1640991600
}
```

| クレーム | 意味 | このプロジェクトでの検証箇所 |
|---|---|---|
| `iss` (Issuer) | 誰が発行したか | `validator.New(...)` の第3引数 = `issuerURL` |
| `aud` (Audience) | 誰向けのトークンか | `config.Auth0Audience` と一致するか |
| `sub` (Subject) | ユーザーの一意なID | `handleProfile` で `claims.RegisteredClaims.Subject` として利用 |
| `exp` (Expiration) | 有効期限（UNIX時間） | 期限切れなら自動的に検証エラー |
| `scope` | 許可されている操作範囲 | `CustomClaims` として取り込み（現状は追加検証なし） |

---

## 7. セキュリティ上のチェックポイント

```mermaid
graph TD
    Token["受信したJWT"] --> C1{"署名は正しいか?<br/>(RS256, JWKS)"}
    C1 -->|NG| Reject["401拒否"]
    C1 -->|OK| C2{"exp: 期限切れでないか?"}
    C2 -->|NG| Reject
    C2 -->|OK| C3{"iss: 想定したAuth0テナントか?"}
    C3 -->|NG| Reject
    C3 -->|OK| C4{"aud: このAPI向けのトークンか?"}
    C4 -->|NG| Reject
    C4 -->|OK| Accept["リクエストを許可"]
```

この4つのうち**どれか1つでも欠けると危険**です。

- 署名検証だけして`aud`を見ないと、**別のAPI向けに発行されたトークンでもこのAPIに侵入できてしまう**
- `iss`を見ないと、**異なるAuth0テナント（あるいは偽サーバー）が発行したトークンを受け入れてしまう**

`backend/main.go` では `validator.New()` に issuer・audienceの両方を渡しているため、この4点は一括でカバーされています。

---

## 8. 用語まとめ

| 用語 | 一言でいうと |
|---|---|
| JWT | 署名付きの自己完結型トークンのフォーマット |
| JWKS | 署名検証用の公開鍵セット（Auth0が配布） |
| RS256 | RSA + SHA-256による非対称署名アルゴリズム |
| クレーム(Claims) | JWTのPayloadに入っている個々のデータ項目 |
| `iss`/`aud`/`sub`/`exp` | 発行者／対象者／主体（ユーザー）／有効期限 |
| ステートレス検証 | サーバー側にセッションを保存せず、トークン単体で正当性を検証できること |

---

図解付きのHTML版は [`jwt-guide.html`](./jwt-guide.html) を参照してください。
