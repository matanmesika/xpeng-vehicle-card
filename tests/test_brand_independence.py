"""Guard against unintended third-party vehicle card assets and copied identifiers.

Text checks complement manual image and licensing review.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {'.js', '.json', '.py', '.md', '.yml', '.yaml', '.css', '.html', '.svg', '.ini', '.csv', '.txt', '.toml'}
BLOCKED = ('te' + 'sla', 'ds' + '2000', 'homeassistant-fe-' + 'te' + 'sla')
SKIP = {'.git', '.pytest_cache', '__pycache__', 'node_modules'}

def test_no_external_vehicle_card_code_names_or_branded_assets():
    issues = []
    for path in ROOT.rglob('*'):
        if not path.is_file() or SKIP.intersection(path.parts):
            continue
        relative = path.relative_to(ROOT).as_posix().lower()
        if any(term in relative for term in BLOCKED):
            issues.append(f'filename: {relative}')
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        content = path.read_text(encoding='utf-8', errors='replace').lower()
        if any(term in content for term in BLOCKED):
            issues.append(f'content: {relative}')
    assert not issues, 'Unexpected third-party branded references:\n' + '\n'.join(issues)
