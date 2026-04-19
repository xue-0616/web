#!/usr/bin/env python3
"""Extract original source files from webpack .map files (sourcesContent)."""
import json, os, sys, glob

def extract_all(build_dir, out_dir):
    maps = glob.glob(os.path.join(build_dir, '**/*.map'), recursive=True)
    print(f"Found {len(maps)} .map files")
    written = 0
    skipped_no_content = 0
    app_files = []
    for mp in maps:
        try:
            with open(mp) as f:
                m = json.load(f)
        except Exception as e:
            print(f"  ! Failed {mp}: {e}")
            continue
        sources = m.get('sources', [])
        contents = m.get('sourcesContent')
        if not contents:
            skipped_no_content += 1
            continue
        for i, src in enumerate(sources):
            if i >= len(contents) or contents[i] is None:
                continue
            # Normalize path: strip leading ./ ../ webpack://xxx/
            p = src
            if p.startswith('webpack://'):
                # remove webpack://<name>/
                parts = p.split('/', 3)
                p = parts[3] if len(parts) > 3 else p
            # Remove leading ../ and ./
            while p.startswith('../') or p.startswith('./'):
                p = p[3:] if p.startswith('../') else p[2:]
            # Skip sources with no real content (webpack markers, etc.)
            if p.startswith('(webpack)') or p == '' or '|' in p:
                continue
            # Skip absolute paths (unsafe)
            if p.startswith('/'):
                p = 'abs_' + p.lstrip('/')
            out = os.path.join(out_dir, p)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, 'w', encoding='utf-8') as f:
                f.write(contents[i])
            written += 1
            if p.startswith('src/') or (not p.startswith('node_modules') and not p.startswith('webpack/')):
                app_files.append(p)
    print(f"Wrote {written} files")
    print(f"Skipped {skipped_no_content} maps with no sourcesContent")
    print(f"\n=== App source files (non-node_modules) ===")
    app_files = sorted(set(app_files))
    for f in app_files[:100]:
        print(f"  {f}")
    if len(app_files) > 100:
        print(f"  ... and {len(app_files)-100} more")
    print(f"\nTotal app files: {len(app_files)}")

if __name__ == '__main__':
    extract_all(sys.argv[1], sys.argv[2])
