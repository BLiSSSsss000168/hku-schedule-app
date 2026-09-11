# 用 GitHub Actions 和 Sideloadly 安装到 iPhone/iPad

这条流程不需要 Mac。GitHub 的 macOS 机器负责编译未签名 IPA，Windows 上的 Sideloadly 使用你的 Apple ID 完成重签名和安装。

## 1. 上传到 GitHub

在 GitHub 新建一个仓库。项目不包含个人课表，因此可以使用公开仓库，公开仓库的 macOS Actions 构建通常不需要付费额度。

在当前项目目录执行：

```bash
git init
git add .
git commit -m "Initial HKU Schedule app"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

也可以在 GitHub 网页创建一个空仓库，然后上传本项目文件。

## 2. 在 GitHub 生成 IPA

1. 打开仓库的 `Actions` 页面。
2. 选择 `Build unsigned iOS IPA`。
3. 点击 `Run workflow`。
4. 等待 macOS 构建完成。
5. 打开成功的构建任务，在页面底部下载 `HKU-Schedule-unsigned-ipa`。

Artifact 下载后是 ZIP，解压会得到：

```text
HKU-Schedule-unsigned.ipa
```

这个 IPA 尚未签名，不能直接安装。

## 3. 在 Windows 安装 Sideloadly

从 Sideloadly 官网下载并安装 Windows 版本：

`https://sideloadly.io/`

必要时同时安装 Apple 官方 iTunes 或 Apple Devices，让 Windows 能识别 iPhone/iPad。

## 4. 使用 Sideloadly 安装

1. 使用数据线连接 iPhone 或 iPad。
2. 在设备上选择“信任此电脑”。
3. 打开 Sideloadly。
4. 将 `HKU-Schedule-unsigned.ipa` 拖入 IPA 框。
5. 输入你的 Apple ID。
6. 点击 `Start`。
7. 输入 Apple ID 密码和双重验证验证码。

Apple ID 密码只会提交给 Apple 的签名服务。不要将密码发送给其他人。

## 5. 在 iPhone/iPad 上信任 App

安装完成后，如果无法打开：

1. 打开“设置”。
2. 进入“通用” → “VPN 与设备管理”。
3. 找到你的 Apple ID 开发者证书。
4. 点击“信任”。

然后即可打开 `HKU Schedule`。

## 6. 七天有效期

使用免费 Apple ID 签名时，App 通常每 7 天需要重新签名安装一次。Sideloadly 会保留安装记录，重新连接后再次点击 `Start` 即可刷新。

使用付费 Apple Developer 账号时，签名有效期通常为一年。

## 注意事项

- 不要在仓库中提交 `node_modules`、`.npm-cache` 或个人课表 JSON。
- GitHub Actions 每次会从空环境执行 `npm ci`，并自动同步 Capacitor 资源。
- 修改 `www` 或 `ios` 后重新推送，Actions 会重新生成 IPA。
- 本项目内置的是空白课表，不会自动加入任何个人课程。
