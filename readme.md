# From scratch
- get the repo `git clone https://github.com/unliketea/PuugPersonalWebRu.git` 
- inside the checkout, install packages: `npm install`
- install required global packages: `npm install -g firebase-tools`
- login or reauth: `firebase login` or `firebase login --reauth`
- define stripe.privatekey in `functions/.runtimeconfig.json`, it might be useful to get current config from firebase
- - remove `demo-` from the beginning of projects.default in `.firebaserc`
- - export config: `firebase functions:config`
- - IMPORTANT: add `demo-` back before running firebase emulators!
- local development requires you define a few other variables in `.env`: 
- - from stripe developers api keys: `GATSBY_STRIPE_PUBLIC_KEY`, 
- - from firebase authentication authorised domains: `GATSBY_FIREBASE_AUTH_DOMAIN`, 
- - from firebase project settings: `GATSBY_FIREBASE_PROJECT_ID` and `GATSBY_FIREBASE_API_KEY`
- for full emulation support including emulated firestore, first build (`gatsby build`) then use: `firebase emulators:start`
- for faster local development THAT USES YOUR CONFIGURED FIREBASE RESOURCES, you can use: `gatsby develop`

# Demo site
https://puugpersonalwebru.web.app/