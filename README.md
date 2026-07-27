# Amazon 跟卖雷达：GitHub Pages + 本地浏览器扩展

一个不需要服务器、不需要数据库、不需要付费API的Amazon报价卖家监控工具。

- `docs/`：部署到GitHub Pages的公共控制台。
- `extension/`：用户本地安装的Chrome/Edge Manifest V3扩展。
- 每个用户通过自己的网络访问Amazon。
- 任务、白名单、设置和历史全部保存在浏览器本地。
- 发现疑似未授权卖家或跟卖消失时显示桌面通知。

## 部署GitHub Pages

1. 新建公开仓库，例如 `gmdog-monitor`。
2. 上传本项目全部文件。
3. 打开仓库 `Settings → Pages`。
4. Source选择 `Deploy from a branch`。
5. Branch选择 `main`，文件夹选择 `/docs`，保存。
6. 等待部署完成，访问 `https://你的用户名.github.io/gmdog-monitor/`。

如果仓库名不是 `gmdog-monitor`，请修改 `extension/background.js` 最后的工具栏跳转地址。

## 收紧扩展的网页权限

发布地址确定后，建议把 `extension/manifest.json` 中：

```json
"https://*.github.io/*"
```

替换成准确地址，例如：

```json
"https://gmiao77.github.io/gmdog-monitor/*"
```

这样扩展只会在你的控制台页面加载网页桥接程序。

## 用户安装扩展

1. 下载项目ZIP并解压。
2. Chrome打开 `chrome://extensions`，Edge打开 `edge://extensions`。
3. 开启右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择项目中的 `extension` 文件夹。
6. 刷新GitHub Pages控制台，顶部应显示“本地监控扩展已连接”。

## 工作方式

扩展每分钟检查任务是否到期，实际商品按照30/60/120分钟间隔运行。到期时：

1. 在当前用户浏览器中短暂打开Amazon报价页。
2. 读取可见报价卖家、Seller ID、价格和FBA/FBM。
3. 与授权卖家白名单比较。
4. 保存结果，状态变化时显示桌面通知。
5. 关闭临时Amazon标签页。

## 免费功能

- 批量监控商品
- 每日监控时段
- 30/60/120分钟间隔
- Seller ID/卖家名称白名单
- 本地历史记录
- JSON导出
- Chrome/Edge桌面通知
- 验证码提示

## 限制

- 浏览器必须保持运行，电脑休眠时无法检测。
- Amazon可能触发验证码或调整页面结构。
- 页面读取不是Amazon官方SP-API，不能保证获得无限完整的报价列表。
- 浏览器开发者模式安装的扩展可能会显示开发者模式提示。
- 不要将自己的白名单、历史数据或浏览器配置提交进GitHub仓库。

## 隐私

GitHub Pages只提供静态界面。任务数据通过页面与本地扩展通信，并保存在`chrome.storage.local`；项目不包含数据服务器或分析脚本。
