// MD Viewer — frontend (Tauri v2)
// Les bindings Tauri sont exposés via withGlobalTauri:true.
// Les plugins (dialog, fs) ne sont PAS auto-attachés à window.__TAURI__ ;
// on les appelle via invoke('plugin:NAME|COMMAND', args).

// Affiche toute erreur directement dans la page (debug)
window.addEventListener('error', (e) => {
  const el = document.getElementById('content') || document.body;
  if (el) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'color:#ff6b6b;padding:20px;white-space:pre-wrap;font-size:13px;background:#1a0000;border:1px solid #ff6b6b;margin:20px;';
    pre.textContent = `JS Error: ${e.message}\nat ${e.filename}:${e.lineno}:${e.colno}`;
    el.prepend(pre);
  }
});

if (!window.__TAURI__) {
  document.body.innerHTML = '<pre style="color:red;padding:40px">window.__TAURI__ non disponible. Vérifier withGlobalTauri:true dans tauri.conf.json.</pre>';
  throw new Error('Tauri API unavailable');
}

const invoke = window.__TAURI__.core.invoke;
const convertFileSrc = window.__TAURI__.core.convertFileSrc;
const listen = window.__TAURI__.event.listen;

// Wrapper dialog.open via invoke direct sur le plugin
async function openDialog(options) {
  return await invoke('plugin:dialog|open', { options });
}

// ===== État =====
let currentFilePath = null;
let currentDir = null;

const $main = document.getElementById('main');
const $content = document.getElementById('content');
const $filename = document.getElementById('filename');
const $tocPanel = document.getElementById('toc-panel');
const $tocNav = document.getElementById('toc-nav');
const $themeBtn = document.getElementById('theme-btn');
const $hljsLight = document.getElementById('hljs-light');
const $hljsDark = document.getElementById('hljs-dark');

// ===== Mermaid init =====
if (window.mermaid) {
  window.mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: { htmlLabels: true, curve: 'basis' }
  });
}

// ===== Post-traitement HTML =====
function dirname(p) {
  if (!p) return null;
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return idx >= 0 ? p.substring(0, idx) : null;
}

function joinPath(base, rel) {
  if (!base) return rel;
  const sep = base.includes('\\') ? '\\' : '/';
  return base.replace(/[\\/]+$/, '') + sep + rel.replace(/^[\\/]+/, '');
}

function isAbsolute(p) {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\');
}

function postProcess() {
  // 1) Images relatives → convertFileSrc(absolute path)
  if (currentDir) {
    $content.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || '';
      if (!src) return;
      if (/^(https?:|data:|blob:|asset:|file:)/i.test(src)) return;
      const absolute = isAbsolute(src) ? src : joinPath(currentDir, src);
      try {
        img.src = convertFileSrc(absolute);
      } catch (_) {
        img.src = 'file://' + absolute;
      }
    });
  }

  // 2) Coloration syntaxique (highlight.js) + extraction des blocs mermaid
  $content.querySelectorAll('pre code').forEach((codeEl) => {
    const classes = codeEl.className || '';
    const langMatch = classes.match(/language-([\w-]+)/);
    const lang = langMatch ? langMatch[1].toLowerCase() : null;

    if (lang === 'mermaid') {
      // Remplace <pre><code class="language-mermaid">…</code></pre> par <div class="mermaid">…</div>
      const pre = codeEl.parentElement;
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = codeEl.textContent;
      pre.replaceWith(div);
      return;
    }

    try {
      if (lang && window.hljs.getLanguage(lang)) {
        const res = window.hljs.highlight(codeEl.textContent, { language: lang, ignoreIllegals: true });
        codeEl.innerHTML = res.value;
      } else {
        const res = window.hljs.highlightAuto(codeEl.textContent);
        codeEl.innerHTML = res.value;
      }
      codeEl.classList.add('hljs');
    } catch (_) {}
  });

  // 3) KaTeX : comrak émet <span data-math-style="inline|display"> et
  //           <pre><code class="language-math" data-math-style="display">
  if (window.katex) {
    $content.querySelectorAll('[data-math-style]').forEach((el) => {
      const display = el.getAttribute('data-math-style') === 'display';
      const tex = el.textContent;
      try {
        const html = window.katex.renderToString(tex, {
          displayMode: display,
          throwOnError: false,
          errorColor: '#cc0000',
          strict: 'ignore'
        });
        // Remplace le nœud entier (span ou pre>code) par le HTML KaTeX
        if (el.tagName === 'CODE' && el.parentElement && el.parentElement.tagName === 'PRE') {
          el.parentElement.outerHTML = html;
        } else {
          el.outerHTML = html;
        }
      } catch (err) {
        el.textContent = '⚠️ ' + err.message;
      }
    });
  }

  // 4) Mermaid render (après extraction)
  if (window.mermaid) {
    const blocks = $content.querySelectorAll('.mermaid');
    blocks.forEach(async (el, i) => {
      const code = el.textContent;
      const id = `mermaid-${Date.now()}-${i}`;
      try {
        const { svg } = await window.mermaid.render(id, code);
        el.innerHTML = svg;
      } catch (err) {
        el.innerHTML = `<pre style="color:#cc0000">Erreur Mermaid: ${String(err.message || err)}</pre>`;
      }
    });
  }

  // 5) Liens externes → navigateur par défaut
  $content.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    } else if (href.startsWith('#')) {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(href.substring(1));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    }
  });

  // 6) Construire la TOC
  buildToc();
}

function buildToc() {
  const headings = $content.querySelectorAll('h1, h2, h3, h4');
  if (headings.length === 0) {
    $tocNav.innerHTML = '<em style="color:#8b949e;font-size:13px">Aucun titre dans ce document</em>';
    return;
  }
  const root = document.createElement('ul');
  $tocNav.innerHTML = '';
  $tocNav.appendChild(root);

  headings.forEach((h, i) => {
    if (!h.id) h.id = 'h-toc-' + i;
    const level = parseInt(h.tagName.substring(1), 10);
    const li = document.createElement('li');
    li.style.marginLeft = ((level - 1) * 12) + 'px';
    const a = document.createElement('a');
    a.textContent = h.textContent.trim();
    a.href = '#' + h.id;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    li.appendChild(a);
    root.appendChild(li);
  });
}

// ===== Rendu =====
async function loadAndRender(filePath) {
  try {
    const result = await invoke('load_file', { path: filePath });
    currentFilePath = result.file_path;
    currentDir = dirname(currentFilePath);

    $content.innerHTML = result.html;
    $main.classList.add('has-content');
    $filename.textContent = result.file_name;
    document.title = `${result.file_name} — MD Viewer`;

    postProcess();
    window.scrollTo(0, 0);
  } catch (err) {
    alert('Erreur : ' + err);
  }
}

// ===== UI handlers =====
document.getElementById('open-btn').addEventListener('click', async () => {
  try {
    const selected = await openDialog({
      multiple: false,
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'txt'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ]
    });
    // Tauri dialog plugin retourne une string (ou null/undefined si annulé)
    if (selected && typeof selected === 'string') {
      loadAndRender(selected);
    } else if (selected && typeof selected === 'object' && selected.path) {
      loadAndRender(selected.path);
    }
  } catch (err) {
    alert('Erreur dialog : ' + err);
  }
});

document.getElementById('toc-btn').addEventListener('click', () => {
  document.body.classList.toggle('toc-open');
  $tocPanel.classList.toggle('hidden');
});

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  $themeBtn.textContent = isDark ? '☀️' : '🌙';
  $hljsDark.disabled = !isDark;
  $hljsLight.disabled = isDark;
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose'
    });
    if (currentFilePath) loadAndRender(currentFilePath);
  }
}

$themeBtn.addEventListener('click', toggleTheme);

// Raccourcis clavier
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    document.getElementById('open-btn').click();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    toggleTheme();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    if (currentFilePath) loadAndRender(currentFilePath);
  }
});

// ===== Drag & drop (événement Tauri natif) =====
listen('tauri://drag-enter', () => {
  document.body.classList.add('drag-over');
});
listen('tauri://drag-leave', () => {
  document.body.classList.remove('drag-over');
});
listen('tauri://drag-drop', (event) => {
  document.body.classList.remove('drag-over');
  const paths = event.payload?.paths || [];
  if (paths.length > 0) {
    loadAndRender(paths[0]);
  }
});

// Empêcher le drop web standard qui naviguerait
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// ===== Fichier passé en argument (double-clic) =====
listen('open-file-path', (event) => {
  if (event.payload) loadAndRender(event.payload);
});
