# Login Redesign + QR Login — Design

Date: 2026-07-04
Status: approved (chat)

## Goal

Replace the NextBase template login page with a branded Synapse login (mobile PWA + desktop), remove magic link, add QR login for employee-created student accounts, and push those students to secure their account with a real email + password.

## Decisions

- **QR login scope**: students only. QR login is rejected once the account has set a password (`credentials_set = true`). Employees/admins always use password.
- **Login methods / tab order**: Password (default) · QR code · Social login. Magic link removed from the UI (server action kept but unused).
- **QR input**: camera scan (existing `useQRScanner` hook) + manual code entry fallback (`SYNAPSE-XXXXXXXX`).
- **"Needs credentials" tracking**: new `profiles.credentials_set boolean not null default false`; backfill `true` for accounts whose auth email does not end in `@synapse.local`. Alert shows while `credentials_set = false`.

## Architecture

### 1. Migration — `supabase/2026-07-04-credentials-set.sql`
- `alter table profiles add column credentials_set boolean not null default false;`
- Backfill from `auth.users`: set `true` where email not like `%@synapse.local`.
- Hand-add the column to `apps/web/src/lib/database.types.ts` (types file is hand-maintained).

### 2. QR sign-in action — `signInWithQrAction` in `data/auth/auth.ts`
Public `actionClient`, schema `{ qr_token }`:
1. Validate `SYNAPSE-` format (`isValidQrTokenFormat`).
2. Admin client: look up `profiles` by `qr_token` → `id, role, credentials_set`.
3. Reject unless `role = 'student'` and `credentials_set = false`. Generic French error for unknown token (no account enumeration); explicit message when a password-protected account tries QR ("use your password").
4. `admin.auth.admin.generateLink({ type: 'magiclink', email })` → `verifyOtp({ type: 'magiclink', token_hash })` with the cookie-backed server client. No email is sent.
5. Return `{ redirectTo: '/student/dashboard' }`.

### 3. Login page redesign — `(auth-pages)/login/` + layout
- Auth layout rebranded (Synapse wordmark, cream background, brand tokens).
- Desktop: two-panel layout (brand panel + auth card). Mobile: single column, QR scan comfortable one-hand use.
- Tabs: Password / QR / Social. New `QrLoginPanel` client component: viewfinder + "Saisir le code manuellement" input; submits to `signInWithQrAction`; success → redirect like password flow.

### 4. Secure-account alert + setup — student area
- `SecureAccountBanner` rendered from `app/student/layout.tsx` when `credentials_set = false`. Non-dismissible, links to `/student/settings#secure`.
- New `setupCredentialsAction` (`studentActionClient`): takes email + password, updates auth user via admin client (`email_confirm: true`, skips confirmation mail since placeholder addresses can't receive it), sets password, flips `credentials_set = true`.
- Settings page: "Sécuriser mon compte" card shown while `credentials_set = false` (email + password + confirm in one form). Existing change-password action also flips `credentials_set = true` as a safety net.

## Error handling
- Invalid/unknown QR: "Code QR invalide ou expiré."
- Password-protected account: "Ce compte est protégé par mot de passe. Connectez-vous avec votre email."
- Camera unavailable: scanner hook error shown, manual entry always available.

## Testing
- Unit tests for `signInWithQrAction` guards (bad format, unknown token, non-student, credentials_set=true) following `students.test.ts` mocking patterns.
- Manual: scan flow on mobile PWA, banner appears, setup form flips flag, QR rejected afterwards.
