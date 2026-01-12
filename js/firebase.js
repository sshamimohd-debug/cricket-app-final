// firebase.js (SAFE for GitHub Pages)
// - Uses Firebase v10+ modular SDK via dynamic import
// - If config is missing/invalid OR SDK fails to load, app runs in "demo" mode (no realtime).
// - Exposes global singleton: window.FB.initFirebase()

(function(){
  const state = { initialized:false, ready:false, demo:true };

  // ✅ Paste your Firebase web config here (Firebase Console -> Project settings -> Your apps -> SDK setup)
  // If you keep it empty, the app will work in DEMO (offline fixtures) mode.
  const firebaseConfig = {
    apiKey: "AIzaSyADkG86Z47OtQNBK2pmlVWbjC5-33bCwfM",
    authDomain: "cricket-app-final.firebaseapp.com",
    projectId: "cricket-app-final",
    storageBucket: "cricket-app-final.firebasestorage.app",
    messagingSenderId: "141050829996",
    appId: "1:141050829996:web:fed92bd59794dc2716d309",
    measurementId: "G-KSRG7994VB"
  };

  function hasConfig(cfg){
    return !!(cfg && cfg.apiKey && cfg.projectId);
  }

  function stub(){
    // Minimal stubs so app doesn't crash in demo mode.
    const noop = ()=>{};
    const rej = async ()=>{ throw new Error("Firebase not configured (demo mode)"); };
    return {
      ready: false,
      demo: true,
      app: null,
      db: null,
      auth: { currentUser: null },
      fs: {
        doc: (..._a)=>({}),
        collection: (..._a)=>({}),
        query: (..._a)=>({}),
        orderBy: (..._a)=>({}),
        limit: (..._a)=>({}),
        serverTimestamp: ()=> null,
        getDoc: rej,
        setDoc: rej,
        updateDoc: rej,
        addDoc: rej,
        onSnapshot: (_ref, _cb)=> noop
      },
      au: {
        onAuthStateChanged: (_auth, _cb)=> noop,
        signInWithEmailAndPassword: rej,
        signOut: async ()=>noop()
      },
      getMyRole: async ()=>"public"
    };
  }

  async function initFirebase(){
    if(state.initialized) return state;
    state.initialized = true;

    // If config missing, keep demo mode.
    if(!hasConfig(firebaseConfig)){
      Object.assign(state, stub());
      return state;
    }

    try{
      // Load SDK modules dynamically (works on GitHub Pages)
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
      const {
        getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection,
        onSnapshot, serverTimestamp, query, orderBy, limit
      } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
      const {
        getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
      } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");

      const app = initializeApp(firebaseConfig);
      const db  = getFirestore(app);
      const auth = getAuth(app);

      async function getMyRole(uid){
        try{
          const ref = doc(db, "users", uid);
          const snap = await getDoc(ref);
          return snap.exists() ? (snap.data().role || "public") : "public";
        }catch(_e){
          return "public";
        }
      }

      state.ready = true;
      state.demo = false;
      state.app = app;
      state.db = db;
      state.auth = auth;
      state.fs = { doc, getDoc, setDoc, updateDoc, addDoc, collection, onSnapshot, serverTimestamp, query, orderBy, limit };
      state.au = { onAuthStateChanged, signInWithEmailAndPassword, signOut };
      state.getMyRole = getMyRole;

      return state;
    }catch(e){
      console.warn("Firebase init failed, running demo mode:", e);
      Object.assign(state, stub());
      return state;
    }
  }

  // IMPORTANT: start as demo until initFirebase() succeeds.
  Object.assign(state, stub());

  window.FB = { initFirebase };
})();
