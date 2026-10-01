# Make thewaittimesnewsletter@gmail.com the only blog admin

## How signing in and posting works
1. Click **Sign in** (top right), sign in with thewaittimesnewsletter@gmail.com (email/password or Google).
2. An **Admin** badge appears in the header.
3. Open the **Blog** tab and use the new-post button to write, preview, save drafts, and publish.

## What is wrong today
- The backend tables for blog posts and roles were created without access permissions, so the app cannot read them. Even an admin never sees the editor, and published posts cannot load for visitors.
- The admin role is currently tied to jasonscottdeloach@gmail.com. The newsletter account already exists but has no admin role.

## Changes
1. Add the missing access permissions:
   - Posts: anyone can read published posts; signed-in users get read/write access, still limited by the existing admin-only rules.
   - Roles: signed-in users can read their own role.
2. Give thewaittimesnewsletter@gmail.com the admin role, and remove it from jasonscottdeloach@gmail.com.
3. Change the automatic admin assignment for new signups so it uses the newsletter email, and only after that email is verified.
4. Fix the sign-up message so it says "check your email to confirm" instead of "You're signed in."

## Technical details
- Migration: `GRANT SELECT ON posts TO anon`; `GRANT SELECT, INSERT, UPDATE, DELETE ON posts TO authenticated`; `GRANT SELECT ON user_roles TO authenticated`; `GRANT ALL` on both to service_role. Recreate `handle_new_user()` to match the new email and require `email_confirmed_at`, and add an update trigger for when the email is confirmed.
- Data: insert an admin row for user f0a62c57-...; delete the admin row for f71eeb07-....
- Update the success message in `Login.tsx`.
