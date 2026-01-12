(async function(){
  const $ = (s)=>document.querySelector(s);
  const msg = $("#msg");

  const PIN_KEY = "mpl_local_pin";

  function getStoredPin(){
    try{ return localStorage.getItem(PIN_KEY) || ""; }catch{ return ""; }
  }
  function setStoredPin(pin){
    try{ localStorage.setItem(PIN_KEY, pin); }catch{}
  }
  function clearStoredPin(){
    try{ localStorage.removeItem(PIN_KEY); }catch{}
  }

  function say(t){ msg.textContent = t; }

  // ---------- Local PIN fallback ----------
  const pinEl = $("#pin");
  const btnPinLogin = $("#btnPinLogin");
  const btnSetPin = $("#btnSetPin");
  const btnClearPin = $("#btnClearPin");

  if(btnSetPin){
    btnSetPin.addEventListener("click", ()=>{
      const p = (pinEl?.value||"").trim();
      if(p.length < 4){ say("PIN कम से कम 4 digit रखें."); return; }
      setStoredPin(p);
      say("PIN saved locally. अब PIN Login करें.");
    });
  }

  if(btnClearPin){
    btnClearPin.addEventListener("click", ()=>{
      clearStoredPin();
      if(window.U && U.clearSession) U.clearSession();
      say("Local PIN cleared.");
    });
  }

  if(btnPinLogin){
    btnPinLogin.addEventListener("click", ()=>{
      const saved = getStoredPin();
      if(!saved){
        say("No PIN set. पहले 'Set / Change PIN' से PIN सेट करें.");
        return;
      }
      const entered = (pinEl?.value||"").trim();
      if(entered !== saved){
        say("Invalid PIN.");
        return;
      }
      if(window.U && U.setSession) U.setSession("scorer", 12);
      say("PIN Login OK (local). Opening scorer console...");
      location.href = `scorer.html?v=${Date.now()}`;
    });
  }

  // ---------- Firebase Login ----------
  // defensive: if firebase.js not loaded
  if(!window.FB){
    say("Error: firebase.js not loaded. Check ../js/firebase.js path.");
    return;
  }

  const FBX = await FB.initFirebase();
  const { auth, au, fs, db, getMyRole, demo } = FBX;

  $("#btnLogin").addEventListener("click", async ()=>{
    try{
      if(demo){
        say("Firebase not configured / SDK load failed. PIN login use करें.");
        return;
      }
      say("Logging in...");
      const email = ($("#email").value||"").trim();
      const pass  = ($("#pass").value||"").trim();

      const cred = await au.signInWithEmailAndPassword(auth, email, pass);
      const uid = cred.user.uid;

      // ensure users doc exists
      const uref = fs.doc(db, "users", uid);
      const usnap = await fs.getDoc(uref);
      if(!usnap.exists()){
        await fs.setDoc(uref, { role:"public", createdAt: fs.serverTimestamp() }, { merge:true });
      }

      const role = await getMyRole(uid);
      if(role !== "admin" && role !== "scorer"){
        say("Login OK, लेकिन role public है. Firestore में users/{UID} -> role = admin/scorer करें.");
        return;
      }

      // Also set local session so main app can gate UI even if auth state is slow to restore
      if(window.U && U.setSession) U.setSession(role, 12);

      say("Login OK. Opening scorer console...");
      location.href = `scorer.html?v=${Date.now()}`;

    }catch(e){
      say("Login failed: " + (e?.message || e));
      console.error(e);
    }
  });
})();
