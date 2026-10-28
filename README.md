# FamilySwipe (working name)

A family dinner app: everyone swipes on recipes, and when enough of the family says "yum" it's a match. Matches turn into the week's dinner plan and a grocery list.

This is the first version. It runs on one shared phone that the family passes around. Syncing across several phones comes next.

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
| Family | Add family members, mark kids, pick avatars, list foods someone never eats, choose what counts as a match, start a new week |
| Swipe | "Who's swiping?" then swipe right (yum) or left (nope). Kids get big photos and Yum / Yuck buttons. Tap a card to see the recipe |
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
- `src/state/store.tsx`: saves everything on the phone

## Before the App Store

- **Recipe key:** TheMealDB's free key ("1") is for development. Get a production key (or switch to Spoonacular) in `src/api/recipes.ts` before launch.
- **Name and IDs:** pick the final name, then update `name`, `slug`, `ios.bundleIdentifier`, and `android.package` in `app.json`.
- **Building for the store:** see "Put it on your iPhone with TestFlight" below.

## Put it on your iPhone with TestFlight

TestFlight installs a real copy of the app on your phone, with no computer needed after that. It uses your Apple Developer account.

1. Create a free account at https://expo.dev/signup.
2. In this folder, run `npx eas-cli@latest login`.
3. Run `npx eas-cli@latest build --platform ios --profile production --auto-submit`.
   - Answer yes when it asks to create the project and to sign in to your Apple account.
   - Let it create the certificates and the App Store Connect app for you.
4. The build runs in the cloud (about 15 to 30 minutes). Then it uploads to App Store Connect, and Apple processes it (another 10 to 30 minutes).
5. Install the **TestFlight** app on your iPhone. Sign in with the same Apple ID, and FamilySwipe shows up there.

To add family testers, open App Store Connect, go to your app, then TestFlight, then Internal Testing, and add their Apple IDs.
