"use strict";
/* Git Manager — Firebase auth + folder/zip + GitHub API.
   Token lives in memory only. Non-secret settings persist in localStorage. */

const $ = (id) => document.getElementById(id);

/* ---------- toast + log ---------- */
function toast(m) {
  const t = $("toast");
  t.textContent = m;
  t.style.display = "block";
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.style.display = "none"), 2200);
}
function log(m) {
  const el = $("log");
  el.textContent += "\n" + m;
  el.scrollTop = el.scrollHeight;
}

/* ---------- memory (non-secret settings only) ---------- */
const MEM = {
  load() {
    try {
      $("repo").value = localStorage.getItem("gm_repo") || "";
      $("branch").value = localStorage.getItem("gm_branch") || "main";
      $("msg").value = localStorage.getItem("gm_msg") || "Upload via Git Manager";
    } catch (e) {}
  },
  save() {
    try {
      localStorage.setItem("gm_repo", $("repo").value.trim());
      localStorage.setItem("gm_branch", $("branch").value.trim() || "main");
      localStorage.setItem("gm_msg", $("msg").value.trim());
    } catch (e) {}
  },
};

/* ---------- Firebase Auth ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAqe8vEdW7_4GBcETsk8zLN9hReNU1BI4I",
  authDomain: "my-own-ai-chat.firebaseapp.com",
  databaseURL: "https://my-own-ai-chat-default-rtdb.firebaseio.com",
  projectId: "my-own-ai-chat",
  storageBucket: "my-own-ai-chat.firebasestorage.app",
  messagingSenderId: "381891057676",
  appId: "1:381891057676:web:f543497a15b2201f9eb629",
  measurementId: "G-793RKW0QQL",
};
let auth = null;
try {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); // stay logged in
} catch (e) {
  $("aX").textContent = "Cannot reach Firebase (open from hosting).";
}

let mode = "L";
function setMode(m) {
  mode = m;
  $("aL").className = m === "L" ? "on" : "";
  $("aS").className = m === "S" ? "on" : "";
  $("aN").hidden = m === "L";
  $("aGo").textContent = m === "L" ? "Log in" : "Sign up";
  $("aX").textContent = "";
}
$("aL").onclick = () => setMode("L");
$("aS").onclick = () => setMode("S");

function enter(u) {
  const nm = u ? u.displayName || (u.email || "").split("@")[0] : "Guest";
  $("uName").textContent = u ? "👤 " + nm : "Guest";
  $("p-auth").classList.remove("on");
  $("app").hidden = false;
  MEM.load();
  syncDelHint();
}
$("aG").onclick = () => enter(null);
$("lo").onclick = async () => {
  try { auth && (await auth.signOut()); } catch (e) {}
  $("app").hidden = true;
  $("token").value = ""; // never keep token across sessions
  $("p-auth").classList.add("on");
};
$("aGo").onclick = async () => {
  const e = $("aE").value.trim(), p = $("aP").value,
        n = $("aN").value.trim(), X = $("aX");
  if (!auth) { X.textContent = "Cannot reach Firebase (open from hosting)."; return; }
  if (!e || p.length < 6) { X.textContent = "Password must be at least 6 chars."; return; }
  try {
    if (mode === "S") {
      const c = await auth.createUserWithEmailAndPassword(e, p);
      if (n) await c.user.updateProfile({ displayName: n });
      enter(auth.currentUser);
    } else {
      await auth.signInWithEmailAndPassword(e, p);
    }
  } catch (x) {
    const m = {
      "auth/email-already-in-use": "This email is already registered.",
      "auth/weak-password": "Password must be at least 6 chars.",
      "auth/network-request-failed": "Cannot reach Firebase (open from hosting).",
      "auth/user-not-found": "No account for this email.",
      "auth/wrong-password": "Wrong email or password.",
    };
    X.textContent = m[x.code] || "Wrong email or password.";
  }
};
auth && auth.onAuthStateChanged((u) => { if (u) enter(u); });

/* ---------- tabs ---------- */
document.querySelectorAll("nav [data-t]").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll("nav [data-t]").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + b.dataset.t));
    $("ttl").textContent = b.querySelector("span").textContent;
  };
});

/* ---------- files ---------- */
const files = []; // {path, file, size}
const fmtSize = (n) =>
  n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(2) + " MB";

function renderList() {
  const ul = $("fileList");
  ul.innerHTML = "";
  $("fileMeta").textContent = files.length
    ? files.length + " file(s) • " + fmtSize(files.reduce((s, f) => s + f.size, 0))
    : "No files loaded.";
  files.slice().sort((a, b) => a.path.localeCompare(b.path)).forEach((f) => {
    const li = document.createElement("li");
    li.innerHTML = "<span></span><small></small>";
    li.firstChild.textContent = f.path;
    li.lastChild.textContent = fmtSize(f.size);
    li.onclick = () => {
      ul.querySelectorAll("li").forEach((x) => x.classList.remove("active"));
      li.classList.add("active");
      previewFile(f);
    };
    ul.appendChild(li);
  });
}
async function previewFile(f) {
  $("prevName").textContent = f.path;
  const box = $("preview").firstChild;
  if (/\.(png|jpe?g|gif|webp|ico|mp4|mp3|pdf|zip|xlsx?|ttf|woff2?)$/i.test(f.path)) {
    box.textContent = "(binary file — preview skipped)"; return;
  }
  if (f.size > 512 * 1024) { box.textContent = "(file too large to preview)"; return; }
  try { box.textContent = (await f.file.text()).slice(0, 60000); }
  catch (e) { box.textContent = "(cannot preview: " + e.message + ")"; }
}
$("dirPick").onchange = (e) => {
  const picked = [...e.target.files];
  e.target.value = "";
  if (!picked.length) return;
  files.length = 0;
  picked.filter((f) => !f.webkitRelativePath.includes("/.git/")).forEach((f) => {
    const p = (f.webkitRelativePath || f.name).replace(/^[^/]+\//, "");
    if (p && !p.endsWith("/")) files.push({ path: p, file: f, size: f.size });
  });
  renderList();
  toast("Loaded " + files.length + " file(s)");
};
$("zipPick").onchange = async (e) => {
  const zf = e.target.files[0];
  e.target.value = "";
  if (!zf) return;
  try {
    const zip = await JSZip.loadAsync(zf);
    files.length = 0;
    for (const n of Object.keys(zip.files)) {
      if (zip.files[n].dir || n.includes("/.git/") || n.startsWith(".git/")) continue;
      const blob = await zip.files[n].async("blob");
      files.push({ path: n, file: blob, size: blob.size });
    }
    renderList();
    toast("Extracted " + files.length + " file(s)");
  } catch (err) { toast("Cannot extract zip"); }
};
$("clearBtn").onclick = () => {
  files.length = 0;
  renderList();
  $("preview").firstChild.textContent = "Select a file to preview code…";
  $("prevName").textContent = "nothing selected";
  $("zipDl").style.display = "none";
};
$("zipBtn").onclick = async () => {
  if (!files.length) { toast("Pick a folder or zip first"); return; }
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.path, f.file));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const a = $("zipDl");
  a.href = URL.createObjectURL(blob);
  a.download = "upload.zip";
  a.style.display = "inline-block";
  toast("Zip ready (" + fmtSize(blob.size) + ")");
};

/* ---------- GitHub API ---------- */
async function gh(path, token, opts = {}) {
  const r = await fetch("https://api.github.com" + path, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("GitHub " + r.status + ": " + (data.message || r.statusText));
  return data;
}
const enc = (p) => encodeURIComponent(p).replace(/%2F/g, "/");
function ctx() {
  const repo = $("repo").value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
  const branch = $("branch").value.trim() || "main";
  const msg = $("msg").value.trim() || "Upload via Git Manager";
  const token = $("token").value.trim();
  if (!repo.includes("/")) { toast("Repo must look like owner/repo"); return null; }
  if (!token) { toast("Paste a token first"); return null; }
  MEM.save();
  syncDelHint();
  return { repo, branch, msg, token };
}
function syncDelHint() { $("delHint").textContent = $("repo").value.trim() || "owner/repo"; }
$("repo").oninput = syncDelHint;

async function fileToB64(f) {
  const buf = new Uint8Array(await f.file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

$("pushBtn").onclick = async () => {
  const c = ctx();
  if (!c) return;
  if (!files.length) { toast("Pick a folder or zip first"); return; }
  const small = files.filter((f) => f.size <= 900 * 1024);
  const big = files.filter((f) => f.size > 900 * 1024);
  big.forEach((f) => log("⏭ skip too large: " + f.path));
  log("Pushing " + small.length + " file(s) to " + c.repo + "@" + c.branch + " …");
  const prog = $("prog");
  prog.style.display = "block";
  let ok = 0, fail = 0;
  for (let i = 0; i < small.length; i++) {
    const f = small[i];
    $("progTxt").textContent = (i + 1) + "/" + small.length + " " + f.path;
    prog.value = Math.round(((i + 1) / small.length) * 100);
    try {
      let sha;
      try {
        const cur = await gh("/repos/" + c.repo + "/contents/" + enc(f.path) + "?ref=" + encodeURIComponent(c.branch), c.token);
        if (cur && cur.sha) sha = cur.sha;
      } catch (e) {}
      await gh("/repos/" + c.repo + "/contents/" + enc(f.path), c.token, {
        method: "PUT",
        body: JSON.stringify({ message: c.msg, content: await fileToB64(f), branch: c.branch, ...(sha ? { sha } : {}) }),
      });
      ok++; log("✅ " + f.path);
    } catch (err) { fail++; log("❌ " + f.path + " — " + err.message); }
  }
  prog.style.display = "none";
  $("progTxt").textContent = "";
  log("Done: " + ok + " pushed, " + fail + " failed, " + big.length + " skipped.");
  toast("Push done: " + ok + " ok, " + fail + " failed");
};

/* create repo */
$("nrBtn").onclick = async () => {
  const c = ctx();
  if (!c) return;
  const name = $("nrName").value.trim();
  if (!name) { toast("Type a repo name"); return; }
  try {
    const r = await gh("/user/repos", c.token, {
      method: "POST",
      body: JSON.stringify({
        name,
        description: $("nrDesc").value.trim(),
        private: $("nrPriv").checked,
        auto_init: true,
      }),
    });
    $("repo").value = r.full_name;
    MEM.save(); syncDelHint();
    log("✅ Repo created: " + r.full_name);
    toast("Repo created");
  } catch (err) { log("❌ create repo — " + err.message); toast("Create failed"); }
};

/* delete file */
$("dfBtn").onclick = async () => {
  const c = ctx();
  if (!c) return;
  const path = $("dfPath").value.trim().replace(/^\//, "");
  if (!path) { toast("Type a file path"); return; }
  if (!confirm("Delete " + path + " from " + c.repo + "?")) return;
  try {
    const cur = await gh("/repos/" + c.repo + "/contents/" + enc(path) + "?ref=" + encodeURIComponent(c.branch), c.token);
    await gh("/repos/" + c.repo + "/contents/" + enc(path), c.token, {
      method: "DELETE",
      body: JSON.stringify({ message: "Delete " + path + " via Git Manager", sha: cur.sha, branch: c.branch }),
    });
    log("✅ Deleted file: " + path);
    toast("File deleted");
  } catch (err) { log("❌ delete file — " + err.message); toast("Delete failed"); }
};

/* delete repo */
$("delBtn").onclick = async () => {
  const c = ctx();
  if (!c) return;
  if ($("delConfirm").value.trim() !== c.repo) {
    toast("Type the repo name to confirm"); return;
  }
  if (!confirm("PERMANENTLY delete " + c.repo + "? This cannot be undone.")) return;
  try {
    await gh("/repos/" + c.repo, c.token, { method: "DELETE" });
    log("✅ Repo deleted: " + c.repo);
    toast("Repo deleted");
    $("delConfirm").value = "";
  } catch (err) {
    log("❌ delete repo — " + err.message + " (needs delete_repo scope)");
    toast("Delete failed");
  }
};

setMode("L");
renderList();
