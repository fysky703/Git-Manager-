"use strict";
/* Git Manager — folder/zip in browser, preview code, zip, push to GitHub.
   No server. Token kept in memory only. */

const $ = (id) => document.getElementById(id);
const files = []; // {path, file(Blob), size}
const logEl = () => $("log");
function log(m) {
  const el = logEl();
  el.textContent += "\n" + m;
  el.scrollTop = el.scrollHeight;
}
function clearLog() { $("log").textContent = ""; }

function fmtSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}

function setFiles(list) {
  files.length = 0;
  list.forEach((f) => files.push(f));
  renderList();
}

function renderList() {
  const ul = $("fileList");
  ul.innerHTML = "";
  $("fileMeta").textContent = files.length
    ? files.length + " file(s) • " + fmtSize(files.reduce((s, f) => s + f.size, 0))
    : "No files loaded.";
  files
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .forEach((f) => {
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
  $("prevSize").textContent = fmtSize(f.size);
  const box = $("preview").firstChild;
  // skip likely-binary
  if (/\.(png|jpe?g|gif|webp|ico|mp4|mp3|pdf|zip|xlsx?|ttf|woff2?)$/i.test(f.path)) {
    box.textContent = "(binary file — preview skipped)";
    return;
  }
  if (f.size > 500 * 1024) {
    box.textContent = "(file too large to preview)";
    return;
  }
  try {
    const txt = await f.file.text();
    box.textContent = txt.slice(0, 60000);
  } catch (e) {
    box.textContent = "(cannot preview: " + e.message + ")";
  }
}

/* --- folder pick --- */
$("dirPick").onchange = async (e) => {
  const picked = [...e.target.files];
  if (!picked.length) return;
  const out = picked
    .filter((f) => !f.webkitRelativePath.includes("/.git/"))
    .map((f) => ({
      path: (f.webkitRelativePath || f.name).replace(/^[^/]+\//, ""),
      file: f,
      size: f.size,
    }))
    .filter((f) => f.path && !f.path.endsWith("/"));
  clearLog();
  log("Loaded folder: " + out.length + " file(s). .git ignored.");
  setFiles(out);
  e.target.value = "";
};

/* --- zip pick + extract (HTML-only, in browser) --- */
$("zipPick").onchange = async (e) => {
  const zf = e.target.files[0];
  e.target.value = "";
  if (!zf) return;
  clearLog();
  log("Extracting zip: " + zf.name + " (" + fmtSize(zf.size) + ") …");
  try {
    const zip = await JSZip.loadAsync(zf);
    const out = [];
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    for (const n of names) {
      if (n.includes("/.git/") || n.startsWith(".git/")) continue;
      const blob = await zip.files[n].async("blob");
      out.push({ path: n, file: blob, size: blob.size });
    }
    log("Extracted " + out.length + " file(s) from zip.");
    setFiles(out);
  } catch (err) {
    log("❌ Cannot extract zip: " + err.message);
  }
};

$("clearBtn").onclick = () => {
  setFiles([]);
  $("preview").firstChild.textContent = "Select a file to preview code…";
  $("prevName").textContent = "nothing selected";
  $("prevSize").textContent = "";
  $("zipDl").style.display = "none";
  clearLog();
  log("Cleared.");
};

/* --- build zip --- */
$("zipBtn").onclick = async () => {
  if (!files.length) { alert("Pick a folder or zip first."); return; }
  log("Building zip …");
  try {
    const zip = new JSZip();
    for (const f of files) zip.file(f.path, f.file);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const url = URL.createObjectURL(blob);
    const a = $("zipDl");
    a.href = url;
    a.download = "upload.zip";
    a.style.display = "inline-block";
    log("✅ Zip ready: " + fmtSize(blob.size) + " — click Download zip.");
  } catch (err) {
    log("❌ Zip failed: " + err.message);
  }
};

/* --- GitHub push via Contents API --- */
const MAX_PUSH = 900 * 1024; // per-file safety limit for base64 contents API

function b64EncodeUnicode(str) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}
async function fileToB64(f) {
  const buf = new Uint8Array(await f.file.arrayBuffer());
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH)
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
  return btoa(bin);
}
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

$("pushBtn").onclick = async () => {
  const repo = $("repo").value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
  const branch = $("branch").value.trim() || "main";
  const msg = $("msg").value.trim() || "Upload via Git Manager";
  const token = $("token").value.trim();
  if (!repo.includes("/")) { alert("Repo must look like owner/repo"); return; }
  if (!token) { alert("Paste a Personal Access Token."); return; }
  if (!files.length) { alert("Pick a folder or zip first."); return; }

  clearLog();
  const prog = $("prog"), ptxt = $("progTxt");
  prog.style.display = "block";
  const small = files.filter((f) => f.size <= MAX_PUSH);
  const big = files.filter((f) => f.size > MAX_PUSH);
  big.forEach((f) => log("⏭ skip (too large for API): " + f.path + " (" + fmtSize(f.size) + ")"));
  log("Pushing " + small.length + " file(s) to " + repo + "@" + branch + " …");

  let ok = 0, fail = 0;
  for (let i = 0; i < small.length; i++) {
    const f = small[i];
    ptxt.textContent = (i + 1) + "/" + small.length + " " + f.path;
    prog.value = Math.round(((i + 1) / small.length) * 100);
    try {
      // get existing sha (for updates)
      let sha;
      try {
        const cur = await gh(
          "/repos/" + repo + "/contents/" + encodeURIComponent(f.path).replace(/%2F/g, "/") + "?ref=" + encodeURIComponent(branch),
          token
        );
        if (cur && cur.sha) sha = cur.sha;
      } catch (e) { /* new file */ }
      const content = await fileToB64(f);
      await gh("/repos/" + repo + "/contents/" + encodeURIComponent(f.path).replace(/%2F/g, "/"), token, {
        method: "PUT",
        body: JSON.stringify({ message: msg, content, branch, ...(sha ? { sha } : {}) }),
      });
      ok++;
      log("✅ " + f.path);
    } catch (err) {
      fail++;
      log("❌ " + f.path + " — " + err.message);
    }
  }
  prog.style.display = "none";
  ptxt.textContent = "";
  log("Done: " + ok + " pushed, " + fail + " failed, " + big.length + " skipped.");
  if (fail) log("Tip: 404 = repo/branch wrong or token lacks access. 403 = rate limit or token scope.");
};
