import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getDatabase } from "firebase/database"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`, // Add this line for Realtime Database
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialize Firebase
let app
let auth
let db
let storage

// Only initialize Firebase if we're in a browser environment and it hasn't been initialized yet
if (typeof window !== "undefined") {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig)
    } else {
      app = getApp()
    }

    auth = getAuth(app)
    db = getDatabase(app)
    storage = getStorage(app)

    // Log connection state changes for debugging
    window.addEventListener("online", () => console.log("App is online"))
    window.addEventListener("offline", () => console.log("App is offline"))
  } catch (error) {
    console.error("Error initializing Firebase:", error)
  }
}

export { app, auth, db, storage }
