#!/bin/bash
cd /Volumes/work/licc/classcritter/classcritter-app
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: release v1.0.20"
git tag v1.0.20
git push
git push origin v1.0.20
