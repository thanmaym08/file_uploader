#!/usr/bin/env python3
"""
AG-OS CLI Wrapper for QuickDrop Pro
Supports multi-file bundle uploads via the command line.

Usage:
    python ag_os.py share file1.jpg file2.png --password secret --burn
"""

import sys
import argparse
import requests
import os

API_URL = os.getenv("QUICKDROP_API", "http://localhost:8000")


def share_files(filepaths, password=None, burn_on_read=False):
    """Upload one or more files as a bundle."""
    # Validate all files exist
    for fp in filepaths:
        if not os.path.exists(fp):
            print(f"❌ Error: File '{fp}' not found.")
            sys.exit(1)

    print(f"📦 Uploading {len(filepaths)} file(s) as a bundle...")

    # Build multipart form data
    files_payload = []
    for fp in filepaths:
        files_payload.append(
            ("files", (os.path.basename(fp), open(fp, "rb")))
        )

    data = {
        "burn_on_read": str(burn_on_read).lower(),
    }
    if password:
        data["password"] = password

    try:
        response = requests.post(f"{API_URL}/drop/upload", files=files_payload, data=data)
        response.raise_for_status()
        result = response.json()

        bundle_id = result.get("bundle_id")
        file_count = result.get("file_count", 0)
        total_bytes = result.get("total_bytes", 0)

        print(f"\n✅ Upload Successful!")
        print(f"   Bundle ID:    {bundle_id}")
        print(f"   Files:        {file_count}")
        print(f"   Total size:   {total_bytes:,} bytes")
        print(f"   Share Link:   {API_URL}/drop/bundle/{bundle_id}")
        print(f"   Download All: {API_URL}/drop/download-all/{bundle_id}")

        if result.get("files"):
            print(f"\n   Files in bundle:")
            for f in result["files"]:
                print(f"     • {f['filename']} ({f['size_bytes']:,} bytes) — SHA-256: {f['sha256'][:12]}...")

        if burn_on_read:
            print("   🔥 Burn on Read: File will self-destruct after first download.")
        if password:
            print("   🔒 Password Protected")

    except requests.exceptions.RequestException as e:
        print(f"❌ Error during upload: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"   Server replied: {e.response.text}")
    finally:
        # Close all file handles
        for _, (_, fh) in files_payload:
            fh.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="AG-OS Core Integration: QuickDrop Pro File Sharing"
    )
    parser.add_argument("command", choices=["share"], help="Command to execute")
    parser.add_argument("filepaths", nargs="+", help="Path(s) to the file(s) to share")
    parser.add_argument("--password", type=str, help="Password protect the bundle")
    parser.add_argument("--burn", action="store_true", help="Enable Download Once & Burn")

    args = parser.parse_args()

    if args.command == "share":
        share_files(args.filepaths, args.password, args.burn)
