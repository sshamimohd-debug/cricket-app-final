// Firebase v10+ modular SDK (CDN via import maps not used; we'll use dynamic import inside)
// This file exports a singleton FB object.

(function(){
  const state = { ready:false };

  async function initFirebase(){
    if(state.ready) return state;

    // Load SDK modules dynamically (works on GitHub Pages)
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const {
      getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection,
      onSnapshot, serverTimestamp, query, orderBy, limit
    } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

    const {
      getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
    } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");

    // TODO: PASTE YOUR FIREBASE CONFIG HERE (from Firebase Console)
    // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyADkG86Z47OtQNBK2pmlVWbjC5-33bCwfM",
  authDomain: "cricket-app-final.firebaseapp.com",
  projectId: "cricket-app-final",
  storageBucket: "cricket-app-final.firebasestorage.app",
  messagingSenderId: "141050829996",
  appId: "1:141050829996:web:fed92bd59794dc2716d309",
  measurementId: "G-KSRG7994VB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

    const app = initializeApp(firebaseConfig);
    const db  = getFirestore(app);
    const auth = getAuth(app);

    async function getMyRole(uid){
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data().role || "public") : "public";
    }

    state.ready = true;
    state.app = app;
    state.db = db;
    state.auth = auth;

    state.fs = { doc, getDoc, setDoc, updateDoc, addDoc, collection, onSnapshot, serverTimestamp, query, orderBy, limit };
    state.au = { onAuthStateChanged, signInWithEmailAndPassword, signOut };
    state.getMyRole = getMyRole;

    return state;
  }

  window.FB = { initFirebase };
})();
