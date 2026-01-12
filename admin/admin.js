(async function(){
  const $ = (s)=>document.querySelector(s);
  const msg = $("#msg");

  function say(t){ msg.textContent = t; }

  // defensive: if firebase.js not loaded
  if(!window.FB){
    say("Error: firebase.js not loaded. Check ../js/firebase.js path.");
    return;
  }

  const FBX = await FB.initFirebase();
  const { auth, au, fs, db, getMyRole } = FBX;

  $("#btnLogin").addEventListener("click", async ()=>{
    try{
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

      say("Login OK. Opening scorer console...");
      location.href = `scorer.html?v=${Date.now()}`;

    }catch(e){
      say("Login failed: " + (e?.message || e));
      console.error(e);
    }
  });
})();
