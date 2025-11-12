"use client";

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA2Tis6Ts57WePUiF9YPTDjRSa1FF_43Rs",
  authDomain: "hotbook-82faa.firebaseapp.com",
  projectId: "hotbook-82faa",
  storageBucket: "hotbook-82faa.firebasestorage.app",
  messagingSenderId: "787381521375",
  appId: "1:787381521375:web:07ef877180e709c49c926a",
  measurementId: "G-PC3NNS4NPW",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Set up Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");

export default app;
