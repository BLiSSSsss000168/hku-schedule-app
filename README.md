# HKU Schedule

离线优先的 HKU 课表 iPhone App。支持导入本地 HKU Event Calendar HTML、手动增删课程、编辑教室与备注，以及生成高清课表图片。

## 功能

- 本地 HTML 导入：识别 `fc-day-header`、`fc-title`、`fc-time` 等 HKU Calendar 页面结构。
- 合并或替换：导入时可保留已经手动填写的教室与备注。
- 手动管理：新增、编辑、删除任意课程时段。
- 类型分类：`LEC` 使用浅蓝色，`TUT` 使用橙色。
- 地点与备注：每个时段独立保存。
- 图片导出：生成 `2400 x 1560` PNG，可通过 iOS 分享面板保存到相册或发送。
- 课前提醒：可按 5、10、15、30、60 分钟或自定义分钟数设置 iOS 本地通知。
- 本地存储：课表只保存在设备当前 App 内，不上传服务器。

## 网页端预览

```bash
npm install
npm run copy:vendor
npm run dev
```

浏览器打开 `http://127.0.0.1:4173`。

## 生成并运行 iOS App

完整依赖和 `ios` 工程已经生成。由于 Apple 签名只能使用 macOS，以下几个步骤需要在 Mac 上执行：

```bash
npm install
npm run copy:vendor
npm run sync:ios
npm run open:ios
```

在 Xcode 中：

1. 选择 `App` Target。
2. 打开 `Signing & Capabilities`。
3. 选择你的 Apple Developer Team。
4. 修改 Bundle Identifier，例如 `com.yourname.hkuschedule`。
5. 连接 iPhone，选择设备后点击 Run。

## HTML 导入说明

HKU 的 `HKUESD.html` 主文件通常只是 frameset。请选择同一保存目录中的：

```text
HKUESD_files/esd.html
```

也可以一次选择多个 HTML 文件，App 会自动识别包含课表的那个文件。网页本身通常不保存教室字段，导入后可在课程编辑器中补充。

## 项目结构

```text
www/              Web App 源代码
ios/              Capacitor 生成的 Xcode 工程
scripts/          开发服务器和依赖复制脚本
capacitor.config.json
package.json
```

修改 `www` 内容后，执行：

```bash
npm run copy:vendor
npm run sync:ios
```

## 没有 Mac 的安装方式

项目包含 GitHub Actions 工作流和 Sideloadly 安装说明：

- `.github/workflows/build-unsigned-ios.yml`
- `SIDELOADLY.md`

流程是：GitHub macOS Runner 编译未签名 IPA，然后在 Windows 上使用 Sideloadly 和 Apple ID 重签名并安装到 iPhone/iPad。
