#!/usr/bin/env python3
"""Read-only audit of tracked vehicle artwork and literal source references."""
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
tracked = [p for p in subprocess.check_output(
    ['git', '-C', str(root), 'ls-files', '-z'], text=True).split('\0') if p]
sources = []
for p in tracked:
    f = root / p
    if p.startswith(('assets/', 'dist/', 'node_modules/')) or f.suffix not in {'.js','.ts','.json','.mjs','.py','.yaml','.yml','.md','.css','.html'}:
        continue
    if f.is_file():
        sources.append((p, f.read_text(encoding='utf-8', errors='replace')))
images = [p for p in tracked if p.startswith('assets/vehicles/') and p.lower().endswith(('.webp','.png','.jpg','.jpeg','.svg'))]
for p in images:
    relative = p.removeprefix('assets/')
    packaged = 'xpeng-asset-' + relative.replace('/', '-')
    refs = [source for source, txt in sources if p in txt or relative in txt or packaged in txt]
    print(('KEEP   ' if refs else 'REVIEW '), p, ', '.join(refs[:3]))
print(f'Checked {len(images)} images. REVIEW is not permission to delete: dynamic runtime paths may exist.')
