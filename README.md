# MD Viewer

Visionneuse Markdown moderne, complète et légère, écrite en **Rust + Tauri** — disponible sur **Windows, macOS et Linux**.

![build](https://github.com/MotherSphere/md-viewers/actions/workflows/build.yml/badge.svg)

## Fonctionnalités

- **GitHub Flavored Markdown** complet (via [comrak](https://github.com/kivikakk/comrak)) : titres, listes, tableaux, citations, liens, images, task lists, strikethrough, autolinks, footnotes, description lists
- **Coloration syntaxique** du code (190+ langages, highlight.js, thèmes clair/sombre)
- **Formules mathématiques** inline et bloc via **KaTeX** (`$...$`, `$$...$$`, ```` ```math ````)
- **Diagrammes Mermaid** (flowchart, séquence, classe, gantt, état…)
- **Table des matières** auto-générée, panneau latéral cliquable
- **Mode sombre** (Ctrl+D)
- **Drag & drop** d'un fichier `.md` dans la fenêtre
- **Bouton Ouvrir** (Ctrl+O) avec filtre sur les extensions Markdown
- **Images relatives** résolues depuis le dossier du fichier
- **Ancres** sur titres, **notes de bas de page**, **front matter** YAML
- **Zoom** (Ctrl +/−), rechargement (Ctrl+R)
- **Association de fichiers** `.md`, `.markdown`, `.mdown`, `.mkd`, `.mkdn`
- **100 % hors-ligne** — aucune ressource externe, tout est vendoré dans l'app

## Captures

*(à ajouter)*

## Installation

Téléchargez la dernière version pour votre système depuis la page [Releases](https://github.com/MotherSphere/md-viewers/releases) :

- **Windows** : `MD Viewer_x.x.x_x64_en-US.msi` (installeur) ou `MD Viewer_x.x.x_x64-setup.exe` (NSIS)
- **macOS** : `MD Viewer_x.x.x_x64.dmg` (Intel) ou `MD Viewer_x.x.x_aarch64.dmg` (Apple Silicon)
- **Linux** : `.AppImage` (portable), `.deb` (Debian/Ubuntu) ou `.rpm` (Fedora)

## Utilisation

1. Ouvrez l'application
2. Cliquez sur **📂 Ouvrir** ou glissez un fichier `.md` dans la fenêtre
3. Lisez, profitez :)

Raccourcis :

| Raccourci | Action |
|---|---|
| **Ctrl+O** | Ouvrir un fichier |
| **Ctrl+D** | Basculer mode sombre |
| **Ctrl+R** | Recharger le fichier courant |
| **Ctrl +/−** | Zoom avant/arrière |

## Développement

Prérequis : [Rust stable](https://rustup.rs/) et les dépendances système Tauri (WebKitGTK sur Linux, aucune dépendance extra sur Windows/macOS).

```bash
# Lancer en mode dev
cd src-tauri
cargo tauri dev

# Build release pour la plateforme courante
cargo tauri build
```

## Architecture

- **Backend Rust** (`src-tauri/`) : rendu Markdown → HTML via `comrak` (extensions GFM, math dollars, footnotes, etc.)
- **Frontend** (`dist/`) : HTML/CSS/JS purs, zéro bundler. Tous les assets sont vendorés dans `dist/vendor/` :
  - `highlight.js` 11 — coloration syntaxique
  - `KaTeX` 0.16 — rendu des maths
  - `Mermaid` 10 — diagrammes
- **IPC Tauri** : commandes `load_file` et `render_markdown` côté Rust, appelées via `invoke()` depuis le JS.

## Builds multi-plateformes

Les binaires Linux / Windows / macOS (Intel + Apple Silicon) sont générés automatiquement par **GitHub Actions** à chaque push sur `main` (voir `.github/workflows/build.yml`).

Pour publier une release avec binaires attachés, pousser un tag :

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Licence

MIT
