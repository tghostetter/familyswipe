# Set up family sync (Supabase)

Family sync lets each person swipe on their own phone or tablet. Grandpa, Mom, Dad and the kids all join the same family with a 6-letter code, and matches work across every device.

The shared data lives in **Supabase**, a free online database. You set it up once, which takes about 10 minutes. Nobody in the family needs an email or password: each device signs in quietly in the background, and the family code is what ties the devices together.

Until you do this, the app keeps working the old way, on one shared phone.

## 1. Create a Supabase account and project

1. Go to https://supabase.com and click **Start your project**. Sign up (signing in with GitHub is easiest).
2. Click **New project**.
   - **Name:** `familyswipe`
   - **Database password:** click **Generate a password**. You won't need it for the app, but save it in your password manager.
   - **Region:** pick the one closest to you (for example *East US*).
   - Plan: **Free** is plenty.
3. Click **Create new project** and wait a minute or two while it starts.

## 2. Create the tables

1. In the left sidebar, click **SQL Editor**.
2. Open the file `supabase/schema.sql` from this project, select everything in it, and copy it.
3. Paste it into the SQL Editor and click **Run** (bottom right).
4. You should see "Success. No rows returned". (It's safe to run it again later if you need to.)

## 3. Turn on "anonymous" sign-ins

This is what lets kids join without an email address.

1. In the left sidebar, click **Authentication**, then **Sign In / Providers** (on some versions it's under **Providers** or **Settings**).
2. Find **Allow anonymous sign-ins** and switch it on.
3. Click **Save**.

## 4. Copy your project's address and key into the app

1. At the top of your project page, click **Connect** (or go to **Project Settings**, then **API Keys**).
2. You need two values:
   - The **Project URL**, which looks like `https://abcdefghijkl.supabase.co`
   - The **publishable key** (starts with `sb_publishable_`), or on older projects the **anon public** key (a long string starting with `eyJ`). Do **not** use the secret / service_role key.
3. In the familyswipe folder on your Mac, run this in Terminal to make your own settings file:
   ```
   cp .env.example .env.local
   open -e .env.local
   ```
4. TextEdit opens. Replace the two example values with yours, save, and close it. It should look like:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijkl.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
   ```
   This file stays on your Mac. It is not uploaded to GitHub.

## 5. Try it

1. Stop the app if it's running (press `Ctrl + C` in Terminal), then start it again so it picks up the new settings:
   ```
   npx expo start --tunnel --clear
   ```
2. On your phone, the app now opens on a **Welcome** screen. Tap **Start a family**. The family you already set up on this phone comes along.
3. Go to the **Family** tab. You'll see your **family code**, like `XP5 59S`. Tap **Send the code** to text it to the family.
4. On a second device (your wife's phone, an iPad, or the iOS Simulator), open the app in Expo Go the same way, tap **Join your family**, and type the code.
5. On each device, go to **Swipe** and tap your own name. The device remembers you after that. On a shared kids' iPad, tap **Switch person** to change who's swiping.

Swipes show up on the other devices within a second or two. When enough of you say yum, the dinner appears on everyone's **Matches** tab.

## Kindle Fire tablets

Kindle Fire tablets run Fire OS, Amazon's version of Android. The app itself works on Android with no changes, but Expo Go isn't in the Amazon Appstore, so testing on a Kindle takes one extra step:

- **For testing now:** on the Kindle, open **Settings → Security & Privacy → Apps from Unknown Sources** and allow the Silk browser. Then, in Silk, go to https://expo.dev/go, download the Android version of Expo Go that matches SDK 58, and install it. After that, scan the QR code from `npx expo start --tunnel` inside Expo Go, just like on the iPhone.
- **For the real release:** you'll build an Android version with `npx eas-cli@latest build --platform android` and publish it to the **Amazon Appstore** (free developer account at https://developer.amazon.com) as well as Google Play.

## When you build for TestFlight

The `.env.local` file only lives on your Mac, so the cloud build needs the same two values. Run these once (with your own values):

```
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://abcdefghijkl.supabase.co --environment production --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_KEY --value sb_publishable_xxxxxxxx --environment production --visibility plaintext
```

## Good to know

- **Free plan:** Supabase pauses a free project after about a week with no activity. If the app says it can't reach your family, open https://supabase.com/dashboard and click **Restore** on the project.
- **Who can see your family:** only devices that typed in your family code. If a code is ever shared by mistake, a device can be removed later; ask Claude to add a "new code" button.
- **Leaving:** the Family tab has **Leave this family on this device** at the bottom. The family keeps all its data.
