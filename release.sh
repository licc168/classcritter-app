#!/bin/bash

# 检查是否传入了版本号参数
if [ -z "$1" ]; then
  echo "错误: 请提供版本号"
  echo "用法: bash release.sh <version> [push]"
  echo "示例1 (更新并推送): bash release.sh 1.0.21"
  echo "示例2 (仅更新本地): bash release.sh 1.0.21 false"
  exit 1
fi

NEW_VERSION=$1

echo ">>> 开始更新版本号至 $NEW_VERSION"

# 使用 Node.js 安全地更新 package.json 和 tauri.conf.json
node -e "
  const fs = require('fs');
  const updateJson = (file) => {
    const content = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(content);
    data.version = process.argv[1];
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  };
  updateJson('package.json');
  updateJson('src-tauri/tauri.conf.json');
" "$NEW_VERSION"

# 使用 sed 更新 Cargo.toml (仅匹配行首的 version)
# 注意：MacOS 下的 sed 需要加空字符串 '' 作为备份后缀参数
sed -i '' -e "s/^version = \"[^\"]*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml

echo ">>> 版本号已更新为 $NEW_VERSION"

SHOULD_PUSH=${2:-"true"}

if [ "$SHOULD_PUSH" = "true" ]; then
  echo ">>> 开始提交代码并打标签"
  git add .
  git commit -m "chore: release v$NEW_VERSION"
  git tag "v$NEW_VERSION"

  echo ">>> 推送到远程仓库"
  git push origin main
  git push origin "v$NEW_VERSION"

  echo ">>> 🎉 发布流程已触发，请前往 GitHub Actions 查看进度！"
else
  echo ">>> 本地版本号更新完毕，未执行 Git 提交和推送。"
fi
