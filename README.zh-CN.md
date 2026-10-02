# luci-app-dae-ui

[English](README.md) | **简体中文**

一个面向 OpenWrt 的 **dae 原生 LuCI 控制中心**。

`luci-app-dae-ui` 将 dae 的日常配置管理、运行时观测、Native API、诊断、GeoData 维护以及可重启恢复的多版本二进制管理整合到同一个 LuCI 应用中。

> **当前版本：** v0.14.2  
> **当前状态：** v0.14.x 功能范围已经基本完成，正式发布前主要剩余 OpenWrt 真机验证。

## 为什么做这个项目

现有 dae 前端通常更偏向“配置编辑”或者“运行状态查看”中的某一部分。

这个项目希望同时解决两类需求，并把 **OpenWrt 运行安全** 放在第一位。

核心原则只有三条：

1. **不伪造运行时数据。**  
   本机能够直接读取的进程和内核数据直接展示；只有 dae Native API 明确声明可用的能力，才显示对应 Native 页面。

2. **不静默改写用户配置。**  
   托管写入必须经过暂存、diff、备份、`dae validate`，失败时自动回退。

3. **DAE 二进制切换不能因为重启而失效。**  
   版本选择持久化，并按照 `selected → last-good → system` 自动回退，同时不改写 `.dae` 配置文件。

## 主要能力

- 原生 LuCI JavaScript 界面
- 简体中文 / 英文自动跟随 LuCI 系统语言
- Overview 与 Runtime 实时状态
- 带上下文补全的 CodeMirror DAE 编辑器
- 支持 include 关系的多文件配置管理
- Validate / Apply / Hot Reload / Rollback 安全链路
- 节点、订阅、策略组、路由、DNS 管理
- Native API capability 自动发现
- 后端支持时显示连接、Flows、运行时策略、DNS 遥测和规则字典
- 基于 generation 的安全 Flow / Rule 关联
- 显式 Node Probe / Group Probe
- GeoData 固定版本与 SHA256 验证更新
- 可重启恢复的 DAE Version Manager
- 日志、诊断、备份和恢复
- Native API Token 与本地文件访问安全边界

## 界面截图

v0.14.2 完成 OpenWrt 真机验证后，会在这里加入**真实路由器界面截图**。README 不会使用生成式预览图冒充正式运行截图。

计划展示：

- 简体中文 **概览**
- 简体中文 **运行状态**，包含已经采集到数据的流量曲线
- 简体中文 **DAE 版本管理**
- 简体中文 **配置文件** CodeMirror 编辑器

截图和脱敏要求见 [docs/screenshots/README.md](docs/screenshots/README.md)。

<!--
![概览](docs/screenshots/overview-zh-cn.png)
![运行状态](docs/screenshots/runtime-zh-cn.png)
![DAE 版本管理](docs/screenshots/versions-zh-cn.png)
![配置编辑器](docs/screenshots/configuration-zh-cn.png)
-->

## 界面结构

插件入口：

```text
服务 → DAE
```

主要页面：

| 页面 | 作用 |
| --- | --- |
| 概览 | 服务、版本、配置验证、dae0、Native API 与 generation 状态 |
| 运行状态 | CPU、内存、Socket、dae0 流量趋势和运行时能力矩阵 |
| 配置文件 | 多文件 DAE 编辑、验证和错误定位 |
| 主配置 | dae 主配置 |
| 节点 | 节点与订阅管理 |
| 策略组 | 策略组和可视化暂存构建器 |
| 路由 | 路由规则与 Native Rule Dictionary |
| DNS | DNS 上游、托管 DNS 和 Native DNS Rules |
| 全部配置段 | DAE 配置结构视图 |
| 配置备份 | Diff、恢复并验证、恢复并热重载 |
| 配置来源 | 已发现配置文件和来源归属 |
| GeoData | GeoIP / GeoSite 固定版本和验证更新 |
| 诊断 | 进程、配置、dae0、默认路由检查 |
| 日志 | 实时日志、暂停、继续、清空 |
| Native API | 能力发现、认证和资源矩阵 |
| DAE 版本 | 多版本二进制管理 |
| 设置 | 路径和集成设置 |

只有后端明确上报 capability 的 Native 功能才会显示。

## Runtime 运行观测

Runtime 页面不依赖 Native API，也可以显示本地运行指标。

包括：

- dae 进程 CPU
- RSS 内存
- 进程运行时间
- dae 进程拥有的 Socket FD 数量
- `dae0` / `dae0peer` 接口计数
- 当前 RX / TX 速率
- 最近 60 秒流量趋势
- 最近 5 分钟流量趋势
- 当前 / 平均 / 峰值速率
- 最近 WARN / ERROR 标记摘要

流量趋势直接根据内核接口计数计算，因此只代表本地接口观测，不会被伪装成 Native API 的代理流量统计。

## 配置编辑

内置 CodeMirror DAE 编辑器支持：

- 行号
- DAE 语法高亮
- 括号匹配
- 自动闭合
- 代码折叠
- `Ctrl+Space` / `Cmd+Space` 智能补全
- `global` / `group` / `dns` / `routing` 上下文补全
- routing matcher 与 outbound / group 补全
- 验证错误 gutter 标记
- 自动跳转到第一个错误

UI 会发现当前配置目录下的 `.dae` 文件。

每次写入都会针对完整主配置执行验证，因此 include 关系会作为整体检查。

### Safe Apply

托管写入流程：

```text
编辑
 ↓
创建时间戳备份
 ↓
dae validate
 ↓
写入
 ↓
hot reload
 ↓
确认结果
```

如果验证或 reload 失败：

```text
失败
 ↓
恢复之前的文件
 ↓
输出诊断信息
```

托管配置文件位于：

```text
config.d/dae-ui-*.dae
```

只有主配置已经包含：

```text
config.d/*.dae
```

时，UI 才允许托管写入。

插件不会为了方便而偷偷修改用户主配置。

## 节点、订阅与策略组

节点和订阅页面在保留高级原始配置的同时，提供结构化摘要和暂存工具。

包括：

- 节点卡片
- 订阅卡片
- 协议识别
- 节点标签
- 订阅标签
- 协议感知节点暂存
- HTTP / HTTPS / SOCKS4 / SOCKS5 URI 构建器
- Native API 可用时按精确标签关联运行时节点
- TCP / UDP 延迟观测
- 展开订阅对应的 runtime members

策略组页面支持：

- 源配置卡片
- 精确 group name 的运行时关联
- 当前 TCP / UDP 选择
- runtime member 数量
- 可视化策略组构建器
- Preview diff

常见策略语法包括：

```text
fixed(0)
min
min_moving_avg
min_avg10
random
```

摘要页面会隐藏凭据、不透明 payload 以及订阅路径 / 查询参数中的敏感信息，但不会改写用户源配置。

## Routing 与 DNS

Routing 和 DNS 页面会把源配置与可用的 Native API 字典结合起来。

### Native Traffic Rules

后端声明 `rules` capability 后，UI 才显示只读规则字典。

规则和当前运行的 `generation_id` 绑定。

规则来源跳转采用：

```text
rule.source.source_id
        ↓
Native config source
        ↓
精确匹配本地 .dae 路径
```

后端用于显示的 file label 不会直接被当作可信本地路径。

### Native DNS Rules

后端声明 `dns_rules` 后，请求规则和响应规则分别显示。

请求动作可能包括：

```text
upstream / asis / reject
```

响应动作可能包括：

```text
accept / reject / requery
```

规则链接必须匹配 generation，不会把旧 Flow 的证据关联到新的当前规则。

## Native API

后端会探测：

```text
/api
/api/v1/capabilities
```

Native 功能全部由 capability 驱动。

可能包含：

- Connections
- Native Nodes
- Node / Group Probe
- Runtime Policies
- Flows
- Routing Trace
- DNS Query
- DNS Cache
- DNS Log
- Routing Rules
- DNS Rules

LuCI 前端不能提交任意 Native API URL。

### Token 安全

可选 Bearer Token 独立保存在：

```text
/etc/dae-ui/native-api.token
```

安全规则：

- Token 目录权限：`0700`
- Token 文件权限：`0600`
- rpcd 不会把 Token 返回浏览器 JavaScript
- 不会自动读取或复制 `native_api.secret`
- Token 只供服务端请求使用
- 卸载插件时删除

即使配置了认证，rpcd gateway 仍只允许固定白名单资源和类型化参数。

## Connections 与 Retained Flow

Connections 和 Flows 均保持只读。

只有后端真实返回 `flow_id` 的连接才会显示 Timeline。

UI 不会为未记录 Flow 的连接虚构 Flow ID。

Flow 详情只从固定路径读取：

```text
GET /api/v1/flows/{flow_id}
```

时间线可以展示：

- input
- route evaluation
- datapath action
- dial mode
- DNS evidence
- reroute decision
- outbound selection
- connection milestone

每一步都会保留：

- `observed_at`
- `elapsed_us`
- `generation_id`
- evidence type
- 原始 JSON

Flow → Rule 链接必须 generation 完全匹配。

## Node Probe / Group Probe

只有 Native API 明确声明所需 capability 后，才显示探测操作。

探测不会自动执行。

必须由用户明确点击运行。

Group Probe：

- 只探测直接成员
- 遵守 group 自身的 `probe_transports`
- 根据 `max_members_per_job` 和 `max_results_per_job` 拆分批次
- 批次串行执行
- 后续批次失败时保留前面已完成结果

## Native Diagnostics

插件只开放共享 Native API 契约中受限的诊断操作。

### DNS Query

使用：

```text
GET /api/v1/dns/query
```

### Routing Trace

使用：

```text
POST /api/v1/routing/trace
```

结果会明确标记为**假设性路由模拟**，不会被描述成真实已经发生的 Flow。

插件不开放：

- 任意连接关闭
- 运行时策略写入
- DNS Cache 删除 / Flush
- 任意配置写入
- 通用 Native API POST
- 任意 URL 代理

## DAE Version Manager

多版本 dae 二进制存放在不可变槽位：

```text
/usr/lib/dae-ui/versions/<slot>/dae
```

### 官方版本

官方 release 只在用户主动请求时从 `daeuniverse/dae` 查询。

安装前会：

1. 按路由器架构过滤 release asset。
2. 从 GitHub metadata 或官方 `.dgst` 获取可信 SHA256。
3. 验证压缩包。
4. 提取 dae 二进制。
5. 执行版本冒烟测试。
6. 使用 OpenWrt dae 服务实际配置执行 `dae validate`。

下载版本不会自动启用。

### 本地二进制与压缩包导入

用户可以直接从浏览器导入可信的本地 dae 可执行文件。v0.14.2 进一步支持直接上传官方或自定义压缩包，不需要先在电脑上手工解压 dae。

支持：

- 原始 dae 可执行文件
- `.zip`
- `.tar.gz`
- `.tgz`

DAE Version Manager 提供明显的拖拽上传区域，也可以直接点击选择文件。

对于压缩包，后端会：

- 固定上传目标为 `/tmp/dae-ui-dae-upload.bin`
- rpcd 只接收原始文件名等元数据，不接受任意服务端文件路径
- 拒绝不安全的压缩包成员路径以及包含过多文件项的压缩包
- 要求压缩包中必须且只能识别到一个 `dae` 或 `dae-*` 有效载荷
- 只把选中的 dae 内容流式提取到私有临时文件，不展开整个压缩包目录树
- 将解压后的 dae 大小限制在 128 MiB
- 同时计算压缩包 SHA256 与 dae 二进制 SHA256
- 执行 dae 版本冒烟测试
- 验证当前服务实际使用的配置文件
- 最终按二进制 SHA256 安装到不可变版本槽位

手动上传仍然属于“用户信任该文件”的导入方式：插件不会因为文件名看起来像官方包，就把离线上传的压缩包宣称为官方已验证 Release。导入成功后也不会自动启用。

### 重启保护

第一次接管前，原始软件包管理的：

```text
/usr/bin/dae
```

会被保存到受保护的 `system` 槽位。

之后 `/usr/bin/dae` 成为持久化 managed runner。

原始：

```text
/etc/init.d/dae
```

保持不变。

版本启动守卫：

```text
/etc/init.d/dae-ui-version
START=98
```

会在正常 dae 服务之前验证：

```text
selected
   ↓
last-good
   ↓
system
```

如果当前版本失败，则自动回退。

回退只改变二进制选择，不会重写用户配置。

如果后续 dae 软件包升级重新覆盖 `/usr/bin/dae`，启动守卫会捕获新的 system binary，保留旧版本为 `system-prev-*`，然后恢复 managed runner。

## GeoData

GeoData 固定版本来源：

```text
daeuniverse/dae/main/scripts/fetch-geo-data.sh
```

只接受：

- 数字 release version
- 64 位十六进制 SHA256

固定版本信息保存在：

```text
/etc/dae-ui/geodata-pins
```

真正的 GeoData 下载仍限制为固定的 v2fly GeoIP 与 domain-list-community release 仓库。

更新流程：

```text
固定上游版本
   ↓
保存 version / SHA256
   ↓
下载到 /tmp
   ↓
SHA256 验证
   ↓
备份现有文件
   ↓
原子替换
```

不会使用未经验证的 `latest/download` URL。

## 备份、日志与诊断

项目包含：

- 配置时间戳备份
- 按文件 Diff
- Restore + Validate
- Restore + Reload
- 对安全 `*.dae:line:column` 验证位置直接跳转编辑器
- 实时日志
- 暂停 / 继续
- 清空日志
- 进程诊断
- 配置验证
- dae0 检查
- 默认路由检查

## 中文支持

v0.14.1 内置简体中文。

插件自动跟随 LuCI 当前语言：

```text
English   → 英文界面
简体中文   → 简体中文界面
```

英文仍是源语言与默认 fallback。

翻译文件：

```text
po/zh_Hans/dae-ui.po
po/templates/dae-ui.pot
```

CI 会检查当前前端和菜单字符串是否缺少简体中文翻译。

## 构建与安装

### GitHub Release 安装包

对于 OpenWrt 25.12.x，创建 `v*` 版本 Tag 后，GitHub Actions 会使用官方 OpenWrt 25.12.5 SDK 自动构建 APK，并将以下文件直接上传到对应 GitHub Release：

```text
luci-app-dae-ui-<version>-r1.apk
SHA256SUMS
INSTALL.txt
```

该插件包为架构无关包（`PKGARCH=all`），但要求系统中已经安装 `dae` 以及声明的 LuCI/rpcd 依赖，或者这些依赖能够从当前软件源获取。

GitHub Release 中的 APK 并不是由 OpenWrt 官方发行版密钥签名，因此下载到路由器后需要明确允许本地非官方包：

```sh
apk add --allow-untrusted /tmp/luci-app-dae-ui-<version>-r1.apk
```

Release 工作流在发布前还会检查 Git Tag 与 Makefile 中的 `PKG_VERSION` 是否完全一致，避免错版本打包。

### 从源码构建

可以将仓库复制或克隆到 OpenWrt build tree 中，例如：

```sh
git clone https://github.com/Accelerator6666/luci-app-dae-ui.git \
    package/luci-app-dae-ui
```

然后通过正常 OpenWrt build system 选择并编译软件包。

该插件依赖 dae 以及对应的 LuCI / rpcd 运行组件。

默认路径：

```text
/usr/bin/dae
/etc/init.d/dae
/etc/dae/config.dae
/var/log/dae/dae.log
```

可以在：

```text
服务 → DAE → 设置
```

中修改集成路径。

## 当前开发状态

v0.14.x 的架构与主要功能已经完成。

正式发布前主要剩余真机验证：

- CodeMirror 补全和行级错误提示
- Runtime 60 秒 / 5 分钟流量曲线
- Native generation 一致性
- 节点 / 订阅 runtime 关联
- Policy 可视化暂存
- Retained Flow Detail
- 自定义 dae 二进制导入
- GeoData 固定版本刷新
- OpenWrt 重启后的 selected slot 保持
- 中文 LuCI 下的简体中文完整显示

详细版本记录请查看：

- [RELEASE_NOTES_v0.14.2.md](RELEASE_NOTES_v0.14.2.md)
- [RELEASE_NOTES_v0.14.0.md](RELEASE_NOTES_v0.14.0.md)
- [CHANGELOG.md](CHANGELOG.md)

## 参考项目

本项目在架构和 UX 上参考了：

- [QiuSimons/luci-app-honk](https://github.com/QiuSimons/luci-app-honk)
- [Zakkaus/doona](https://github.com/Zakkaus/doona)
- Doona / dae Native API 文档与契约思路

目标不是复制其中任何一个项目，而是构建一个具有明确安全边界的 OpenWrt 原生 dae 控制面板。

## License

GPL-3.0-only.
