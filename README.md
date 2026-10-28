# FamilySwipe (working name)

A family dinner app: everyone swipes on recipes, and when enough of the family says "yum" it's a match. Matches turn into the week's dinner plan and a grocery list.

Each person can swipe on their own phone or tablet: everyone joins the same family with a 6-letter code. To turn that on, follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) (about 10 minutes, free). Until then, the app runs on one shared phone that the family passes around.

## Try it on your iPhone

You need a computer (Mac or Windows) and your iPhone on the same Wi-Fi.

1. On your iPhone, install **Expo Go** from the App Store.
2. On your computer, install **Node.js** (the "LTS" version) from https://nodejs.org.
3. Unzip this folder, open a terminal in it, and run:
   ```
   npm install
   npx expo start
   ```
4. A QR code appears in the terminal. Point your iPhone camera at it and tap the link. The app opens in Expo Go.

Changes to the code show up on the phone right away while `npx expo start` is running.

## What's in the app

| Tab | What it does |
| --- | --- |
| Family | Shows your family code for adding phones and tablets. Add family members, mark kids, pick avatars, set each person's food preferences (favorite dinners and cuisines, meats and other foods they never eat), choose what counts as a match, start a new week |
| Swipe | Tap your name (each device remembers you), then swipe right (yum) or left (nope). Kids get big photos and Yum / Yuck buttons. Tap a card to see the recipe |
| Matches | Dinners the family agreed on. "Add" puts one on the next empty night |
| Plan | Monday to Sunday. "Fill empty nights" uses your matches |
| Groceries | Every ingredient for the planned dinners, combined, with check boxes |

## Where the code lives

- `App.tsx`: the tab bar and screens
- `src/screens/`: one file per tab
- `src/components/`: the swipe cards, match pop-up, and recipe page
- `src/logic/matching.ts`: the match rules (everyone, majority, parents plus a kid)
- `src/logic/grocery.ts`: builds the grocery list
- `src/api/recipes.ts`: loads recipes and photos from TheMealDB
- `src/state/store.tsx`: keeps the app's data on the phone and sends changes to the family
- `src/sync/`: talks to Supabase (joining a family, saving swipes, live updates)
- `src/screens/WelcomeScreen.tsx`: "Start a family" or "Join your family"
- `supabase/schema.sql`: the database tables, pasted into Supabase once

## Before the App Store

- **Recipe key:** TheMealDB's free key ("1") is for development. Get a production key (or switch to Spoonacular) in `src/api/recipes.ts` before launch.
- **Name and IDs:** pick the final name, then update `name`, `slug`, `ios.bundleIdentifier`, and `android.package` in `app.json`.
- **Building for the store:** `npx eas-cli@latest build --platform ios` then `npx eas-cli@latest submit --platform ios`, signed in with your Apple Developer account.
