(async function(){
  const $ = (s)=>document.querySelector(s);
  const msg = $("#msg");

  const FBX = await FB.initFirebase();
  const { auth, au, getMyRole, fs, db } = FBX;

  $("#btnLogin").addEventListener("click", async ()=>{
    msg.textContent = "Logging in...";
    try{
      const email = ($("#email").value||"").trim();
      const pass  = ($("#pass").value||"").trim();
      const cred = await au.signInWithEmailAndPassword(auth, email, pass);

      // Ensure users/{uid} exists (first time)
      const uid = cred.user.uid;
      const uref = fs.doc(db, "users", uid);
      const usnap = await fs.getDoc(uref);
      if(!usnap.exists()){
        await fs.setDoc(uref, { role:"public", createdAt: fs.serverTimestamp() }, { merge:true });
      }

      const role = await getMyRole(uid);
      if(role !== "admin" && role !== "scorer"){
        msg.textContent = "Login ok, लेकिन role public है. Firestore में role 'admin' या 'scorer' कर दें.";
        return;
      }

      location.href = "scorer.html";
    }catch(e){
      msg.textContent = "Login failed: " + (e?.message || e);
    }
  });
})();
