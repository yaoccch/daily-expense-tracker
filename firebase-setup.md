# Firebase setup for the shared expense tracker

Use GitHub Pages for hosting and Firebase for private shared data.

## 1. Create Firebase project

1. Open https://console.firebase.google.com/
2. Create a project.
3. Add a Web app.
4. The Firebase config for `expense-3ddb0` is already in `expense-tracker.js`. If you create a different Firebase project later, replace that config object with the new one.

## 2. Enable email/password login

1. Go to Authentication.
2. Open Sign-in method.
3. Enable Email/Password.
4. Create exactly the two users who should use this app.

## 3. Authorize GitHub Pages

1. Go to Authentication.
2. Open Settings.
3. Open Authorized domains.
4. Add `yaoccch.github.io`.

## 4. Create Firestore database

1. Go to Firestore Database.
2. Create a database.
3. Start in production mode.
4. Publish the rules from `firestore.rules`.

## 5. Add the two members

After creating the two Auth users, copy each user's UID.

In Firestore, create:

```text
households/shared-household/members/USER_UID_1
households/shared-household/members/USER_UID_2
```

Each member document can contain:

```json
{
  "role": "member"
}
```

The app stores expenses under monthly folders:

```text
households/shared-household/months/2026-06/expenses
households/shared-household/months/2026-07/expenses
```

Only signed-in users with a member document can read or write expenses.
