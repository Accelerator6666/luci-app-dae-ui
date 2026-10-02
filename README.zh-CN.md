# luci-app-dae-ui

[English](README.md) | **简体中文**

一个面向 **dae** 的现代化 LuCI 管理界面。项目参考了多个现有实现的架构与交互思路，但并不直接复制任何一个项目：

- `QiuSimons/luci-app-honk`：参考 OpenWrt 软件包结构、rpcd/Ucode 模式以及服务生命周期集成方式。
- `Zakkaus/doona`：参考状态、连接、DNS、策略、路由、节点、配置和日志等信息架构与 UX。
- Doona 文档 / API 契约：参考 capability-driven 的运行时能力模型，为未来 dae Native API 集成提供统一边界。

## 设计原则

本项目首先保证在**普通 dae 安装环境下现在就能用**。

因此，当前 UI 会直接管理 dae 已经能够在本机提供的能力，包括：

- dae 进程状态
- 配置文件
- `dae validate`
- `dae reload`
- 日志
- 系统诊断
- GeoData
- 多版本 dae 二进制管理

对于 dae 当前没有暴露的数据，本项目不会为了界面完整而伪造 Doona 资源。

当 dae 提供共享的 daeuniverse Native API 契约时，**Native API** 页面会作为运行时能力入口，按后端实际声明的 capabilities 启用连接、DNS 遥测、策略状态、路由追踪、Flow 历史、节点探测等功能。

## v0.14.1

v0.14.1 在 v0.14.0 的基础上加入完整的 LuCI 简体中文支持：

- 自动跟随 OpenWrt / LuCI 系统语言。
- 英文作为源语言与默认回退语言。
- 简体中文使用 `zh_Hans` / `zh-cn`。
- 当前菜单、页面、按钮、提示、弹窗、错误信息和大部分 rpcd 后端状态消息均已覆盖。
- DAE、Native API、GeoData、SHA256、PID、eBPF、TCP/UDP、IPv4/IPv6 等技术术语按需要保留英文。
- CI 会检查新增前端字符串是否缺少简体中文翻译，避免后续版本重新出现中英文混杂。

## 核心功能

### 概览

**服务 → DAE → 概览** 提供 dae 当前关键状态：

- 服务运行状态
- PID
- 内存占用
- 进程运行时间
- dae 版本
- 当前二进制入口
- Version Manager 状态
- 当前选择槽位
- last-good 槽位
- 实际运行二进制
- 当前配置文件
- 已发现的 `.dae` 文件数量
- 配置验证状态
- `dae0` eBPF 接口状态
- Native API 可用性
- Native API generation 一致性
- 默认路由
- 最近备份
- 网络接口信息

概览页面会自动刷新，并提供：

- 启动
- 热重载
- 重启
- 挂起
- 停止

### Runtime

Runtime 页面以 2 秒周期采集本地运行指标：

- dae 进程 CPU
- RSS 内存
- 进程运行时间
- Socket FD 数量
- `dae0` / `dae0peer` 接口计数
- dae0 RX / TX 当前速率
- 60 秒流量趋势
- 5 分钟流量趋势
- 当前 / 平均 / 峰值速率
- 最近 WARN / ERROR 标记摘要

流量趋势直接来自内核接口计数，仅用于本地运行观察，不会被当作 Native API 的代理流量统计。

Runtime 还会显示 Native API capability matrix，明确区分：

- 本地可观测指标
- 需要 Native API 的连接资源
- 节点探测 / 延迟
- Runtime Policy
- Flows
- Routing Trace
- DNS Cache / DNS Log 等

只有后端明确声明能力可用时，对应入口才会出现。

## DAE Version Manager

**服务 → DAE → DAE 版本**

项目包含持久化的 **DAE Version Manager**，用于在同一台 OpenWrt 上管理多个 dae 二进制版本，同时不改写用户的 `.dae` 配置。

每个已安装版本存放在独立不可变槽位：

```text
/usr/lib/dae-ui/versions/<slot>/dae
```

### 官方版本

官方 release 仅在用户主动点击时从 `daeuniverse/dae` 查询。

下载流程会：

1. 根据路由器架构过滤 release asset。
2. x86_64 可识别上游 v1、v2/SSE、v3/AVX2 变体。
3. 校验来自最新 GitHub release metadata 或官方 `.dgst` 的可信 SHA256。
4. 解压二进制。
5. 执行版本冒烟测试。
6. 使用 **OpenWrt dae 服务实际使用的配置文件** 执行 `dae validate`。
7. 验证全部通过后才安装到版本槽位。

下载一个版本**不会自动启用**。

只有用户明确点击 **启用并重启** 后，才会：

1. 再次验证目标二进制与服务配置。
2. 持久化当前选择槽位。
3. 重启 dae。
4. 检查 `/proc/<pid>/exe` 是否指向目标槽位。
5. 运行确认成功后，将该槽位标记为 **last-good**。

如果运行时重启失败，则自动恢复之前的 last-good / system 槽位并重新启动 dae。

### 自定义 dae 二进制

可以上传可信的本地 dae 可执行文件。

后端会：

- 只接受固定临时上传路径
- 拒绝符号链接和非普通文件
- 限制文件大小为 1 KiB–128 MiB
- 计算 SHA256
- 执行 dae 版本冒烟测试
- 验证当前服务配置
- 根据 SHA256 创建不可变自定义槽位

导入成功后仍然**不会自动启用**。

### 重启安全

在 Version Manager 第一次接管前，原始软件包管理的：

```text
/usr/bin/dae
```

会先复制到受保护的 `system` 槽位。

之后 `/usr/bin/dae` 会成为稳定的 managed runner，根据持久化选择启动真正的 dae binary，因此原始 OpenWrt：

```text
/etc/init.d/dae
```

不需要修改。

版本启动守卫：

```text
/etc/init.d/dae-ui-version
```

使用：

```text
START=98
```

而上游 dae 服务通常为：

```text
START=99
```

因此每次启动时会按以下顺序验证：

```text
selected
   ↓
last-good
   ↓
system
```

如果当前选择的二进制无法通过服务配置验证，就自动回退。

版本回退只改变 dae 二进制选择状态，**不会自动回滚或修改用户配置文本**。

如果未来 dae 软件包升级重新覆盖 `/usr/bin/dae`，启动守卫会：

1. 捕获新的软件包二进制作为新的 `system`。
2. 将旧 system 保存为不可变的 `system-prev-*` 回退槽位。
3. 重新安装 managed runner。

卸载 `luci-app-dae-ui` 时，如果 `/usr/bin/dae` 仍由 managed runner 管理，则恢复已捕获的 system 二进制。

## 配置管理

### CodeMirror 编辑器

项目内置本地 CodeMirror DAE 编辑器：

- 行号
- DAE 语法高亮
- 括号匹配
- 自动闭合
- 代码折叠
- `Ctrl+Space` / `Cmd+Space` 智能补全
- 针对 `global`、`group`、`dns`、`routing` 的上下文补全
- 路由 matcher 与 outbound / group 补全
- 验证错误行 gutter 标记
- 自动定位第一个验证错误

### 多文件配置

UI 会发现当前配置目录中的 `.dae` 文件，并理解 include 关系。

支持：

- 主配置
- Configuration Files
- Config Sources
- All Sections

能够识别：

- `global`
- `subscription`
- `node`
- `group`
- `routing`
- `dns`
- `experimental`

等配置段。

### Safe Apply

所有受管理的配置写入都遵循安全流程：

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
自动恢复上一版本文件
 ↓
重新验证 / 恢复运行
```

### 托管配置段

UI 使用：

```text
config.d/dae-ui-*.dae
```

保存托管配置。

只有主配置已经 include：

```text
config.d/*.dae
```

时，UI 才允许托管写入。

项目不会为了方便而自动修改用户主配置。

支持快速暂存：

- 节点
- 订阅
- 策略组
- 路由规则
- DNS 分流模板

所有托管写入都可以先查看 **Preview diff**。

## Nodes / Subscriptions

节点和订阅页面提供：

- 源文件归属
- 卡片式汇总
- 协议识别
- 节点标签
- 订阅标签
- 与 Native runtime inventory 的精确标签关联
- 后端报告的 TCP / UDP 延迟
- 订阅 runtime member 展开

节点暂存表单支持标准分享链接，并对协议 scheme 进行校验。

简单 URI 构建器可以生成：

- HTTP
- HTTPS
- SOCKS4
- SOCKS5

复杂协议继续保留其标准分享链接语法。

摘要卡片会隐藏：

- URI 用户名 / 密码
- VMess / SS / SSR 等不透明 payload
- 订阅路径和查询参数中的敏感内容

但不会改写用户原始配置。

## Policies

策略组页面提供：

- 源配置卡片
- 精确 group name runtime 关联
- 当前 TCP / UDP 选择
- runtime member 数量
- 可视化策略组构建器
- Preview diff

可视化构建器支持：

- 精确节点标签
- subscription tag
- `fixed(0)`
- `min`
- `min_moving_avg`
- `min_avg10`
- `random`

高级过滤条件仍可以直接编辑。

## Routing

Routing 页面提供：

- 路由规则摘要
- 源文件定位
- 托管规则暂存
- Preview diff
- Native Rule Dictionary

Native Rule Dictionary 只在后端声明 `rules` capability 时出现。

规则与运行时 `generation_id` 绑定，并显示：

- Rule ID
- evaluation index
- kind
- expression
- outbound
- must
- source metadata

规则来源不会直接把后端显示用的 `file` 标签当作本地路径。

UI 会使用：

```text
rule.source.source_id
        ↓
GET /api/v1/config
        ↓
精确匹配本地 .dae 路径
```

只有路径完全匹配时，才提供跳转到本地编辑器的链接。

## DNS

DNS 页面提供：

- 上游配置卡片
- 托管 DNS 编辑
- split-DNS 模板
- request / response routing
- Native DNS Runtime
- Native DNS Rule Dictionary

Native DNS Rule Dictionary 基于：

```text
GET /api/v1/dns/rules
```

请求规则与响应规则分开显示。

请求动作：

- `upstream`
- `asis`
- `reject`

响应动作：

- `accept`
- `reject`
- `requery`

规则链接同样要求 `generation_id` 与当前完整 DNS dictionary 一致，不会跨运行代次关联。

## Native API

Native API 页面会在本机探测：

```text
/api
/api/v1/capabilities
```

不会自动从 dae 配置中提取 `native_api.secret`。

### Token 安全

可选 Bearer Token：

```text
/etc/dae-ui/native-api.token
```

安全边界：

- 不写入 UCI
- 目录权限 0700
- token 文件权限 0600
- rpcd 不会把 token 返回浏览器 JavaScript
- 不会自动复制 `native_api.secret`
- 只供服务端 curl 使用
- 卸载插件时删除

即使配置了认证，rpcd gateway 仍然只允许固定白名单资源和类型化查询参数。

前端不能提交任意 URL，也不能借此调用任意 Native API。

## Native Connections / Flows

Connections、Nodes、Flows 与 DNS Runtime 支持：

- 本地搜索
- 过滤
- 列排序
- 25 / 50 / 100 / 200 行客户端分页

Nodes、Flows、DNS Cache 和 DNS Log 支持 Native API cursor 增量加载。

第一页保持实时。

当用户加载第二个服务器 cursor 页面时，会冻结当前 snapshot，避免后续数据与更新后的 generation 混合。

每个数据集本地最多保留 5000 行。

cursor 过期或失效时会明确提示，而不是静默重新开始。

## Retained Flow Trace

项目包含可复用的 **Retained Flow Trace Timeline**。

Flow 详情仅从固定路径读取：

```text
GET /api/v1/flows/{flow_id}
```

时间线按 `seq` 排序，可展示完整因果链：

- input
- traffic / DNS route evaluation
- datapath action
- dial mode
- DNS evidence
- reroute decision
- outbound selection
- connection milestone

每一步保留：

- `observed_at`
- `elapsed_us`
- `generation_id`
- evidence type

并可以展开查看原始 step JSON。

### Connections → Flow Timeline

只有后端真实返回 `flow_id` 的连接才会出现 Timeline。

UI 不会为没有记录 flow 的连接虚构 Flow ID。

### Flow → Rule

Flow 与规则的关联必须同时满足：

- 保留的 route step 存在
- `chain=traffic`
- `rule_id` 相同
- `generation_id` 非空
- Flow 的 generation 与当前完整 Rule Dictionary generation 完全一致

否则 UI 会明确显示 generation mismatch 或证据缺失，而不会猜测规则关联。

## Node Probe / Group Probe

只有 Native API 同时声明相应能力时，才显示节点或策略组探测。

Node Probe 的：

- kind
- transport
- IP family

都来自后端 capability contract。

`tcp_connect` 与 `http` 强制使用 TCP。

DNS probe 只使用后端声明可用的 DNS transport。

探测不会自动运行，也不会在页面刷新时触发。

必须由用户明确点击 **运行探测**。

rpcd 在提交前会再次校验 capability，拒绝后端没有声明的 target / kind / transport / IP 组合。

### Group Probe

策略组探测只针对直接成员。

UI 会先读取 group 详情，并遵守 group 自身的 `probe_transports` 限制。

成员根据：

- `max_members_per_job`
- `max_results_per_job`

拆分成显式 member-ID 批次。

批次串行执行，上一批进入终态之前不会提交下一批。

如果后续批次失败，前面已经完成的结果仍然保留。

## Native Diagnostics

Native Diagnostics 只开放受限诊断操作。

### DNS Query

使用：

```text
GET /api/v1/dns/query
```

参数采用固定类型白名单，并显示请求预览。

### Routing Trace

仅使用：

```text
POST /api/v1/routing/trace
```

请求由服务端构造受限的 `RoutingTraceRequest`。

UI 会明确标记结果属于**假设性路由模拟**，不是已经发生的真实流量记录。

项目不会开放：

- 关闭任意连接
- 修改运行时策略
- 删除 / flush DNS cache
- 任意配置写入
- 通用 Native API POST
- 任意 URL 转发

## GeoData

GeoData 页面能够检测：

- `geoip.dat`
- `geosite.dat`

版本固定信息从 dae 上游固定来源读取：

```text
daeuniverse/dae/main/scripts/fetch-geo-data.sh
```

只接受：

- 纯数字 release version
- 64 位十六进制 SHA256

固定版本元数据保存到：

```text
/etc/dae-ui/geodata-pins
```

真正下载 GeoData 时仍然只使用固定的 v2fly GeoIP 与 domain-list-community release 仓库。

更新流程：

```text
固定上游版本
   ↓
持久化 version / SHA256
   ↓
下载到 /tmp
   ↓
SHA256 验证
   ↓
备份现有文件
   ↓
原子替换
```

不会使用未经校验的 `latest/download` URL。

## 备份与恢复

每次配置写入前都会生成带时间戳的备份。

Backup 页面支持：

- 查看历史备份
- 与当前文件比较 diff
- Restore + Validate
- Restore + Reload

配置验证输出中的安全路径：

```text
*.dae:line:column
```

会被解析。

保存失败和 Diagnostics 可以直接跳到对应 Configuration Files 页面，并滚动到出错行。

## 日志与诊断

Logs 页面支持：

- 自动刷新
- 暂停
- 继续
- 清空

Diagnostics 会检查：

- dae 进程状态
- 配置验证
- dae0
- 默认路由
- 相关运行环境

## 安装与开发

将项目复制到 OpenWrt build tree 中作为软件包构建，或者将软件包内容安装到标准 LuCI 目录。

默认运行路径：

```text
/usr/bin/dae
/etc/init.d/dae
/etc/dae/config.dae
/var/log/dae/dae.log
```

可以在：

**服务 → DAE → 设置**

中修改。

## 当前 v0.14.x 状态

v0.14.x 已完成主要功能开发，当前重点是 OpenWrt 真机验证，而不是继续做架构重写。

当前需要重点验证：

- CodeMirror 智能补全
- 编辑器行级错误提示
- Runtime 60 秒 / 5 分钟流量趋势
- Native API generation 一致性
- 节点 / 订阅 runtime 关联
- Policy 可视化暂存
- Retained Flow Detail
- DAE Version Manager 自定义二进制
- GeoData 固定版本刷新
- 重启后 selected dae slot 是否保持
- LuCI 简体中文自动跟随与完整显示

## License

GPL-3.0-only.
