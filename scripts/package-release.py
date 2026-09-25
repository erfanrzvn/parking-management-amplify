"""Build reproducible deployment archives without overwriting the user's dist/."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parents[1]
out = root / 'build' / 'release'
out.mkdir(parents=True, exist_ok=True)
with ZipFile(out / 'api.zip', 'w', ZIP_DEFLATED) as bundle:
    for path in sorted((root / 'lambda').glob('*.js')):
        bundle.write(path, path.name)
    bundle.writestr('package.json', '{"type":"commonjs"}\n')
    for path in sorted((root / 'lambda' / 'node_modules').rglob('*')):
        if path.is_file():
            bundle.write(path, path.relative_to(root / 'lambda').as_posix())
frontend = root / 'build' / 'frontend'
if not (frontend / 'index.html').is_file():
    raise SystemExit('Build the frontend into build/frontend first')
with ZipFile(out / 'frontend.zip', 'w', ZIP_DEFLATED) as bundle:
    for path in sorted(frontend.rglob('*')):
        if path.is_file():
            bundle.write(path, path.relative_to(frontend).as_posix())
manifest = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.glob('*.zip'))}
(out / 'sha256.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'directory': str(out), 'sha256': manifest}, indent=2))
