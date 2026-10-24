import { mkdir, copyFile, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { build } from "esbuild";
const root = new URL(".", import.meta.url);
const dist = new URL("./dist/", root);
await rm(dist, { recursive: true, force: true });
await mkdir(new URL("owner/", dist), { recursive: true });
for (const [source, target] of [["login.html", "index.html"], ["login.css", "login.css"], ["styles.css", "styles.css"], ["styles.css", "owner/styles.css"], ["app.js", "owner/app.js"], ["workspace-session.js", "owner/workspace-session.js"]]) {
  await copyFile(new URL(source, root), new URL(target, dist));
}
let workspace = await readFile(new URL("index.html", root), "utf8");
workspace = workspace.replaceAll('href="./styles.css"','href="/owner/styles.css"').replaceAll('src="./app.js"','src="/owner/app.js"').replaceAll('href="./start/"','href="/owner/"').replaceAll('src="projects.js"','src="/owner/projects.js"').replaceAll('src="owner-actions.js"','src="/owner/owner-actions.js"');
workspace = workspace.replace('</head>', '<meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/login.css"><script src="/owner/workspace-session.js" defer></script></head>');
workspace = workspace.replace('This preview never contacts n8n, Netlify APIs, OpenAI, or Gemini.', 'Sign-in is active. Image generation and live jobs are not connected yet.');
workspace = workspace.replace('<div class="composer-wrap">', '<p class="panel desk-new-job-note" role="note">New jobs are sent from <a href="/owner/">the New case page</a>, the only page that confirms the photo facts before sending. This page keeps the job queue, billing reconciliation and reader recovery.</p><div class="composer-wrap" hidden>');
await mkdir(new URL('owner/controls/', dist), { recursive: true });
await writeFile(new URL("owner/controls/index.html", dist), workspace);
let start = await readFile(new URL('start.html', root), 'utf8');
start = start.replace('</head>', '<script src="/owner/start-connected.js" defer></script><script src="/owner/start-session.js" defer></script></head>');
await writeFile(new URL('owner/index.html', dist), start);
await build({ entryPoints: [new URL("login-client.mjs", root).pathname], outfile: new URL("login.js", dist).pathname, bundle: true, minify: true, platform: "browser", target: "es2022" });

await copyFile(new URL('owner-actions.js', root), new URL('owner/owner-actions.js', dist));

await copyFile(new URL('projects.js',root),new URL('owner/projects.js',dist));
for (const file of ['start.css', 'palette.js', 'preview-image.js', 'case-timeline.js', 'start.js', 'edit-options.js', 'start-connected.js', 'start-session.js', 'upload-examples.js', 'previous-work-data.js', 'previous-work.js', 'catalogue-import.js']) await copyFile(new URL(file, root), new URL('owner/' + file, dist));
await mkdir(new URL('owner/start/', dist), { recursive: true });
for (const file of ['start.html', 'start.css', 'palette.js', 'preview-image.js', 'case-timeline.js', 'start.js', 'edit-options.js', 'upload-examples.js', 'previous-work-data.js', 'previous-work.js', 'catalogue-import.js']) {
  if (file === 'start.html') await writeFile(new URL('owner/start/index.html', dist), start);
  else await copyFile(new URL(file, root), new URL('owner/start/' + file, dist));
}

await mkdir(new URL('owner/start/results/', dist), { recursive: true });
await writeFile(new URL('owner/start/results/index.html', dist), start);
await copyFile(new URL('start.css', root), new URL('owner/start/results/start.css', dist));
await copyFile(new URL('start.js', root), new URL('owner/start/results/start.js', dist));
await copyFile(new URL('case-timeline.js', root), new URL('owner/start/results/case-timeline.js', dist));
await copyFile(new URL('edit-options.js', root), new URL('owner/start/results/edit-options.js', dist));
await copyFile(new URL('preview-image.js', root), new URL('owner/start/results/preview-image.js', dist));
await copyFile(new URL('palette.js', root), new URL('owner/start/results/palette.js', dist));
await copyFile(new URL('upload-examples.js', root), new URL('owner/start/results/upload-examples.js', dist));
for (const file of ['previous-work-data.js', 'previous-work.js', 'catalogue-import.js']) await copyFile(new URL(file, root), new URL('owner/start/results/' + file, dist));
await mkdir(new URL('owner/results/', dist), { recursive: true });
await writeFile(new URL('owner/results/index.html', dist), start);
await copyFile(new URL('start.css', root), new URL('owner/results/start.css', dist));
await copyFile(new URL('start.js', root), new URL('owner/results/start.js', dist));
await copyFile(new URL('case-timeline.js', root), new URL('owner/results/case-timeline.js', dist));
await copyFile(new URL('edit-options.js', root), new URL('owner/results/edit-options.js', dist));
await copyFile(new URL('preview-image.js', root), new URL('owner/results/preview-image.js', dist));
await copyFile(new URL('palette.js', root), new URL('owner/results/palette.js', dist));
await copyFile(new URL('upload-examples.js', root), new URL('owner/results/upload-examples.js', dist));
for (const file of ['previous-work-data.js', 'previous-work.js', 'catalogue-import.js']) await copyFile(new URL(file, root), new URL('owner/results/' + file, dist));
// Choose from Midas: the catalogue page (owner-only) that imports up to 10 products into the Studio.
await mkdir(new URL('owner/catalogue/', dist), { recursive: true });
for (const name of ['index.html', 'catalogue.css', 'catalogue.js', 'catalogue-data.js']) await copyFile(new URL('catalogue/' + name, root), new URL('owner/catalogue/' + name, dist));
await copyFile(new URL('palette.js', root), new URL('owner/catalogue/palette.js', dist));
// Overview (/owner/overview/): a read-only home with three counts, what needs the owner and recent jobs; links into the studio page.
await mkdir(new URL('owner/overview/', dist), { recursive: true });
await copyFile(new URL('overview.html', root), new URL('owner/overview/index.html', dist));
for (const file of ['overview.css', 'overview.js', 'overview-model.js', 'palette.js']) await copyFile(new URL(file, root), new URL('owner/overview/' + file, dist));
// Previous work images are served once from /owner/previous-work/img/ for every owner page.
await mkdir(new URL('owner/previous-work/img/', dist), { recursive: true });
for (const name of await readdir(new URL('previous-work/img/', root))) await copyFile(new URL('previous-work/img/' + name, root), new URL('owner/previous-work/img/' + name, dist));
await mkdir(new URL('consumer/', dist), { recursive: true });
for (const file of ['consumer.html','consumer.css','consumer.js','palette.js']) {
  const target = file === 'consumer.html' ? 'consumer/index.html' : 'consumer/' + file;
  await copyFile(new URL(file, root), new URL(target, dist));
}

// One new-job screen (owner's decision, 22 Oct 2026): only /owner/ can send a job, because only it confirms the
// photo facts the server requires. The retired screens (/owner/draft3/, /owner/client/, /owner/guide/, /owner/desk/)
// are no longer published; netlify.toml sends their addresses to /owner/. Their sources stay in studio/ and client/.

// Testing models per stage (/owner/model-tests/): compares model setups for one A7 stage on the same photo.
await mkdir(new URL("owner/model-tests/", dist), { recursive: true });
await copyFile(new URL("model-tests.html", root), new URL("owner/model-tests/index.html", dist));
for (const name of ["model-tests.css", "model-tests.js"]) await copyFile(new URL(name, root), new URL("owner/model-tests/" + name, dist));
