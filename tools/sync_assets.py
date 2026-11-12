#! /usr/bin/env python3
# vim:fenc=utf-8
#
# Copyright © 2026 stantonik <stantonik@stantonik-mba>
#
# Distributed under terms of the MIT license.

"""

"""

from rclone import Rclone
from pathlib import Path
import hashlib
import pathspec
import json
import sys

REMOTE_NAME = "r2"
BUCKET_NAME = "portfolio-sja"

IGNORE_FILE_LIST = [
    ".DS_Store",
    "**/assets/original/**"
]

def compare_manifests(old: dict[str, str], new: dict[str, str]):
    old_keys = old.keys()
    new_keys = new.keys()

    return {
        "added": new_keys - old_keys,
        "removed": old_keys - new_keys,
        "modified": {
            key
            for key in old_keys & new_keys
            if old[key] != new[key]
        },
    }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("not enough args")
        sys.exit(1)

    root = Path(sys.argv[1])
    manifest_file = root / "manifest.json"
    manifest = {}

    ignores = IGNORE_FILE_LIST.copy()
    ignores.extend([manifest_file.name])
    spec = pathspec.PathSpec.from_lines("gitwildmatch", ignores)

    for path in root.rglob("*"):
        if not path.is_file():
            continue

        relative = path.relative_to(root)

        if spec.match_file(relative):
            continue

        with open(path, 'rb') as f:
            digest = hashlib.file_digest(f, "sha256").hexdigest()[:12]

        name_hash = f"{path.stem}.{digest}{path.suffix}"
        manifest[str(relative)] = str(relative.parent / name_hash)

    if not manifest_file.exists() or manifest_file.stat().st_size == 0:
        old_manifest = {}
    else:
        old_manifest = json.loads(manifest_file.read_text(encoding="utf-8"))

    res = compare_manifests(old_manifest, manifest)

    added = res["added"]
    modified = res["modified"]
    removed = res["removed"]

    if not (added or modified or removed):
        print("no change.")
        sys.exit(0)

    for path in sorted(added):
        print(f"A  {path}")

    for path in sorted(modified):
        print(f"M  {path}")

    for path in sorted(removed):
        print(f"D  {path}")

    print("push to remote?")
    while 1:
        res = input("y/N> ")
        if len(res) == 0 or res == "n":
            sys.exit(0)
        elif res == "y":
            break
        print("value should be one of the following characters: n, y")

    rc = Rclone()
    path_to_r2 = lambda path: f"{REMOTE_NAME}:{BUCKET_NAME}/{path}"

    print("pushing changes...")

    for path in added:
        rc.copyto(root / path, path_to_r2(manifest[path]), "--header-upload", "Cache-Control: public, max-age=31536000, immutable")

    for path in modified:
        rc.deletefile(path_to_r2(old_manifest[path]))
        rc.copyto(root / path, path_to_r2(manifest[path]), "--header-upload", "Cache-Control: public, max-age=31536000, immutable")

    for path in removed:
        rc.delete(path_to_r2(old_manifest[path]))

    print("updating manifest...")

    manifest_file.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    rc.copyto(manifest_file, path_to_r2(manifest_file.name), "--header-upload", "Cache-Control: public, max-age=600")

    print("done")
