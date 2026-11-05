#!/usr/bin/env python3
"""
Puts a built Warded Atlas pack (scripts/build-pack.py) on Cloudflare R2, where the app reads it.

    pip install boto3
    R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… python3 scripts/upload-pack.py PACK_DIR [--bucket warded-atlas-pack]

Uploads every picture not already there (same size), then manifest.json last, so the app never
lists a piece whose pictures aren't up yet. Pictures are cached for a year (their names change
when they do: a new rev), the manifest for five minutes. Setup steps for the bucket, its web
address (packs.wardedatlas.com) and the key: the R2 notes in docs/ACCOUNT_SETUP.md.
"""
import argparse
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import boto3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pack")
    ap.add_argument("--bucket", default="warded-atlas-pack")
    args = ap.parse_args()
    for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"):
        if not os.environ.get(k):
            sys.exit(f"{k} isn't set.")
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    there = {}
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=args.bucket):
        for o in page.get("Contents", []):
            there[o["Key"]] = o["Size"]
    files = []
    for root, _, names in os.walk(args.pack):
        for n in names:
            p = os.path.join(root, n)
            key = os.path.relpath(p, args.pack).replace(os.sep, "/")
            if key != "manifest.json" and there.get(key) != os.path.getsize(p):
                files.append((p, key))
    print(f"{len(files)} pictures to upload ({len(there)} already there)", flush=True)

    def put(item):
        p, key = item
        with open(p, "rb") as f:
            s3.put_object(Bucket=args.bucket, Key=key, Body=f, ContentType="image/webp", CacheControl="public, max-age=31536000, immutable")

    done = 0
    with ThreadPoolExecutor(16) as pool:
        for _ in pool.map(put, files):
            done += 1
            if done % 500 == 0:
                print(f"  {done} of {len(files)}", flush=True)
    with open(os.path.join(args.pack, "manifest.json"), "rb") as f:
        s3.put_object(Bucket=args.bucket, Key="manifest.json", Body=f, ContentType="application/json", CacheControl="public, max-age=300")
    print("Done, manifest.json last.")


if __name__ == "__main__":
    main()
