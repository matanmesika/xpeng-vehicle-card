#!/usr/bin/env python3
"""Import 16 exact reviewed charging WebPs from the local review ZIP.

This is an opt-in local import. No files are written without --apply.
The archive contains generated illustrations, not manufacturer-verified photos.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_GROUPS = {'g6/2023-2025': 5, 'g7/2025': 6, 'g9/2025-2026': 5}
ZIP_PREFIX = 'xpeng-vehicle-card/'


def checked_payloads(archive: Path) -> dict[str, bytes]:
    from PIL import Image
    payloads = {}
    groups = {group: 0 for group in EXPECTED_GROUPS}
    with zipfile.ZipFile(archive) as z:
        audit = json.loads(z.read(ZIP_PREFIX + 'sources/charging-cable-replacement-audit.json'))
        entries = audit.get('files', [])
        assert len(entries) == 16, 'Audit must contain exactly 16 corrected images'
        for entry in entries:
            model, generation, paint = entry['model'], entry['year_group'], entry['paint']
            group = f'{model}/{generation}'
            assert group in EXPECTED_GROUPS, f'Unexpected generation: {group}'
            assert paint and paint.replace('_', '').isalnum(), f'Unsafe paint slug: {paint}'
            path = f'assets/vehicles/{group}/{paint}/charging.webp'
            assert entry['path'] == path, f'Unexpected audited path: {entry["path"]}'
            assert path not in payloads, f'Duplicate asset: {path}'
            data = z.read(ZIP_PREFIX + path)
            assert hashlib.sha256(data).hexdigest() == entry['after_sha256'], f'Hash mismatch: {path}'
            assert data[:4] == b'RIFF' and data[8:12] == b'WEBP', f'Invalid WebP: {path}'
            with Image.open(io.BytesIO(data)) as im:
                im.load()
                assert im.format == 'WEBP' and im.mode == 'RGBA', f'Not transparent WebP: {path}'
                assert im.size == (1448, 1086), f'Wrong dimensions: {path}'
                assert im.getchannel('A').getextrema() == (0, 255), f'No transparent background: {path}'
            payloads[path] = data
            groups[group] += 1
    assert groups == EXPECTED_GROUPS, f'Incomplete model coverage: {groups}'
    return payloads


def import_archive(archive: Path, *, apply: bool = False, root: Path = ROOT) -> int:
    payloads = checked_payloads(archive)
    for path, data in sorted(payloads.items()):
        target = root / path
        status = 'unchanged' if target.is_file() and target.read_bytes() == data else 'update'
        print(f'{status:9s} {path} ({len(data):,} bytes)')
        if apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            rel = Path(path).relative_to('assets')
            mirrors = [
                root / 'dist/assets' / rel,
                root / 'dist' / ('xpeng-asset-' + str(rel).replace('/', '-')),
            ]
            for mirror in mirrors:
                mirror.parent.mkdir(parents=True, exist_ok=True)
                mirror.write_bytes(data)
    print(f'PASS: {len(payloads)} audited charging views; G6 2026 and front/top untouched; '
          + ('written' if apply else 'dry-run only'))
    print('NOTICE: Manufacturer and human design fidelity review still pending.')
    return len(payloads)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    import_archive(args.archive, apply=args.apply)


if __name__ == '__main__':
    main()
