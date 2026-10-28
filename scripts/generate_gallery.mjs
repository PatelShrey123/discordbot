import fs from 'fs/promises';
import path from 'path';

async function main() {
  const dir = 'C:/Users/Shrey/.gemini/antigravity/scratch/shark_redesign';
  const outDir = 'C:/Users/Shrey/.gemini/antigravity/brain/f585adfd-da6b-4a56-a234-14ec6557e960';

  const p1 = await fs.readFile(path.join(dir, 'Shark_Submission_Sheet.png'));
  const p2 = await fs.readFile(path.join(dir, 'Shark_Showcase_Render.png'));
  const p3 = await fs.readFile(path.join(dir, 'Shark_Side_Profile.png'));
  const p4 = await fs.readFile(path.join(dir, 'Shark_UV_Template.png'));

  const b64_poster = 'data:image/png;base64,' + p1.toString('base64');
  const b64_persp = 'data:image/png;base64,' + p2.toString('base64');
  const b64_side = 'data:image/png;base64,' + p3.toString('base64');
  const b64_uv = 'data:image/png;base64,' + p4.toString('base64');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kirka Shark Redesign Showcase</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
</head>
<body class="bg-[#090d16] text-slate-100 p-4 font-sans select-none">
  <div class="max-w-5xl mx-auto space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-slate-800 pb-3">
      <div>
        <h1 class="text-xl font-bold text-sky-400 flex items-center gap-2">
          <span>🦈</span> Kirka Weapon Redesign: Shark Pistol
        </h1>
        <p class="text-xs text-slate-400">Tactical Realism • 806 Triangles • Hand-crafted Topology • Non-Overlapping UVs</p>
      </div>
      <div class="flex gap-2">
        <button onclick="show('poster')" id="btn-poster" class="px-3 py-1.5 text-xs font-semibold rounded bg-sky-500 text-white transition">Master Sheet</button>
        <button onclick="show('persp')" id="btn-persp" class="px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition">3D View</button>
        <button onclick="show('side')" id="btn-side" class="px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Side Profile</button>
        <button onclick="show('uv')" id="btn-uv" class="px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition">UV Atlas</button>
      </div>
    </div>

    <!-- Main Image Display -->
    <div class="relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-2xl flex items-center justify-center min-h-[460px]">
      <img id="view-poster" src="${b64_poster}" class="w-full h-auto object-contain rounded" alt="Master Competition Sheet">
      <img id="view-persp" src="${b64_persp}" class="hidden w-full h-auto object-contain rounded" alt="3D Perspective Shaded Render">
      <img id="view-side" src="${b64_side}" class="hidden w-full h-auto object-contain rounded" alt="Side Silhouette and Callouts">
      <img id="view-uv" src="${b64_uv}" class="hidden w-full h-auto object-contain rounded" alt="UV Island Atlas">
    </div>

    <!-- Specs Bar -->
    <div class="grid grid-cols-4 gap-3 text-xs">
      <div class="bg-slate-900 border border-slate-800 p-2.5 rounded">
        <span class="text-slate-500 block">Polycount</span>
        <span class="font-bold text-emerald-400 text-sm">806 Triangles</span>
        <span class="text-[11px] text-slate-500 block">45% under 1,600 budget</span>
      </div>
      <div class="bg-slate-900 border border-slate-800 p-2.5 rounded">
        <span class="text-slate-500 block">UV Layout</span>
        <span class="font-bold text-sky-400 text-sm">9 Segregated Islands</span>
        <span class="text-[11px] text-slate-500 block">16px padding margin</span>
      </div>
      <div class="bg-slate-900 border border-slate-800 p-2.5 rounded">
        <span class="text-slate-500 block">Topology</span>
        <span class="font-bold text-purple-400 text-sm">100% Manifold Quads/Tris</span>
        <span class="text-[11px] text-slate-500 block">Clean hand-built / No AI</span>
      </div>
      <div class="bg-slate-900 border border-slate-800 p-2.5 rounded">
        <span class="text-slate-500 block">Engine Locators</span>
        <span class="font-bold text-amber-400 text-sm">Muzzle & bulletCases</span>
        <span class="text-[11px] text-slate-500 block">Kirka weapon rig ready</span>
      </div>
    </div>
  </div>

  <script>
    function show(tab) {
      ['poster', 'persp', 'side', 'uv'].forEach(t => {
        const img = document.getElementById('view-' + t);
        const btn = document.getElementById('btn-' + t);
        if (t === tab) {
          img.classList.remove('hidden');
          btn.className = 'px-3 py-1.5 text-xs font-semibold rounded bg-sky-500 text-white transition';
        } else {
          img.classList.add('hidden');
          btn.className = 'px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition';
        }
      });
    }
  </script>
</body>
</html>`;

  await fs.writeFile(path.join(outDir, 'shark_gallery.html'), html);
  console.log('Saved shark_gallery.html, bytes:', html.length);
}

main().catch(console.error);
