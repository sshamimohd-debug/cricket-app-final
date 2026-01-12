(function(){
  const routes = {};
  const app = ()=>document.getElementById("app");

  function setActiveTab(path){
    const key = (path.split("/")[1] || "home");
    document.querySelectorAll(".tab").forEach(a=>{
      a.classList.toggle("active", a.dataset.tab === key);
    });
  }

  async function loadPage(pagePath){
    const res = await fetch(pagePath, {cache:"no-store"});
    if(!res.ok) throw new Error("Page not found: "+pagePath);
    return await res.text();
  }

  async function navigate(){
    const hash = location.hash || "#/home";
    const [path, qs] = hash.slice(1).split("?");
    setActiveTab(path || "/home");

    const handler = routes[path] || routes["/404"];
    if(!handler) return;

    const params = new URLSearchParams(qs||"");
    await handler({ path, params, mount: app() });
  }

  function on(path, handler){ routes[path] = handler; }

  function start(){
    window.addEventListener("hashchange", navigate);
    navigate();
  }

  window.R = { on, start, loadPage };
})();
