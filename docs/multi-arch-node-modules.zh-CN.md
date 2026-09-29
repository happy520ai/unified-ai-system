# linux/arm64 上 better-sqlite3 抛出 "invalid ELF header"：错误的 CPU 架构 node_modules 陷阱

以多平台方式发布的 Node 镜像，它的 `linux/arm64` 标签里可能装着 x86-64 原生模块，于是第一次
`require()` 该包就会失败并抛出 `invalid ELF header`。2026-09-29 从我们自己镜像的四个已发布版本实测；
不需要 Docker 引擎，也没有执行任何代码。

## 你大概就是带着这个报错来的

一个 Node 镜像以多平台方式发布。在 Apple Silicon Mac，或任何 arm64 主机上，容器能启动，但第一次触碰原生模块就失败：

```
Error: /app/node_modules/better-sqlite3/build/Release/better_sqlite3.node: invalid ELF header
    at Module._extensions..node (node:internal/modules/cjs/loader:1601:18)
```

路径是对的，文件在，权限也没问题。问题在于：**arm64 镜像里装的是一个 x86-64 共享对象**，动态加载器拒绝它。
Dockerfile 看上去没有任何一处写错，因为安装动作大概率并不是在目标架构的机器上发生的 —— 它只跑了一次，
产出的 `node_modules` 被同时复制进了两个平台的镜像。

这是我们自己的 bug，在我们自己发布的镜像里，被我们自己的工具读出来的。已开
[issue #190](https://github.com/happy520ai/unified-ai-system/issues/190)，读数字见
[mcp-image-review-0.8.0.md](https://github.com/happy520ai/unified-ai-system/blob/master/docs/security/mcp-image-review-0.8.0.md)。
之所以把它写成一篇独立文章而不只留在 issue 里，是因为这个失败模式很常见，而验证它只要两条命令 ——
它应该出现在搜索结果里。

## 这个陷阱有确定的形状

多平台构建的 layer 会分成两类：

- **由架构决定的 layer**：在每个平台的构建阶段内部产生，例如基础镜像、`apt` 包、该阶段编译出的任何东西。
  Docker 会按平台解析出正确的 base image，所以这些天然是对的。
- **被复制的 layer**：只产生一次，然后 `COPY` 进每个阶段，最常见的就是依赖树。`pnpm install` / `npm ci`
  跑在某个 runner 上，`better-sqlite3` 的 `install` 钩子（`prebuild-install || node-gyp rebuild --release`）
  于是解析出 **runner 架构** 的预编译包，而不是目标架构的。做完的 `/app` 被复制进两个镜像。

所以标签声明 `linux/arm64`，manifest 里也确实有 arm64 child，`docker manifest inspect` 看起来完全正常 ——
而里面的原生模块是 x86-64。registry 层面能检查的东西全部通过，只有文件字节会说不一致。

同一陷阱还有一个更安静的形态：带平台后缀的 `optionalDependencies`（`@napi-rs/canvas-linux-x64-gnu`、
`lightningcss-linux-x64-gnu`、`@rollup/rollup-linux-arm64-gnu`）。npm 与 pnpm 按 **安装机** 的平台挑选它们，
于是在 x86-64 runner 上的一次安装会记录并落地 x64 那一组，arm64 镜像拿到的就是 x64 二进制，
外加一个不会承认 arm64 版本存在的 lockfile。

## 不用容器也会踩到同一个陷阱

容器只是其中一条路。任何「跨多个目标复用同一个 `node_modules` 目录」的打包步骤都会走到这里：先打 Linux x64、再对着同一棵树打 macOS universal 的桌面构建，可能把**上一个目标**的原生二进制装进包里，因为树上还留着「这个平台已经构建过了」的过期标记，原生模块重建就被跳过了。

有交叉校验时，你会在构建期就拿到报错：

```text
Expected all non-binary files to have identical SHAs when creating a universal build
  but "Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node" did not
```

没有校验时，构建期完全安静，要等应用启动才炸——Linux 上是 `invalid ELF header`，Windows 上是 `not a valid Win32 application`。上游记录见 [electron-userland/electron-builder#10031](https://github.com/electron-userland/electron-builder/issues/10031)，该 issue 的作者把成因定位到重建路径里的「跳过重建标记」，而不是任何容器相关的形状。

两种形状要配两种不同的检查，而且「什么时候能看到」这一点很关键：

- **跨顺序目标构建共享同一个 `node_modules`**——打包前的信号是那个重建标记仍然写着**第一个**目标的名字。你在发布任何东西之前就能看到它，修的位置也应该在这里。
- **已经存在的产物**（已发布的镜像、tarball、`.asar`）——信号是每个 `.node` 文件偏移 18 处的 `e_machine`，下一节就是它。它说不出「为什么装错了」，而且要等到发布之后才会开火。

下一节那个按字节读的做法属于第二种。我们只在自己的容器镜像上量过它；本节内容不构成对任何其他项目行为的测量。

## 不用 Docker 引擎怎么检查一个镜像

registry 会用匿名 pull token 把 layer tarball 交出来。我们的读取器是
`tools/inspect-image-filesystem.mjs`（零依赖：`node:crypto`、`node:zlib`、全局 `fetch`），
它不会创建也不会运行容器：

```bash
node tools/inspect-image-filesystem.mjs 0.8.0 --arch arm64
```

```
native      8 modules, expected ELF machine 0xb7, arch_mismatch=4, foreign_platform=4
  mismatch    app/node_modules/.../better_sqlite3.node (64-bit LSB x86-64)
IMAGE_REVIEW version=0.8.0 arch=arm64 layers=21 files=21864 native_modules=8 elf_arch_mismatch=4 problem_count=0
```

如果你不想跑我们的代码，同一个问题只需两次请求加一个字节偏移：

```bash
TOKEN_URL="https://ghcr.io/token?scope=repository:<owner>/<repo>/mcp-server:pull"
BASE="https://ghcr.io/v2/<owner>/<repo>/mcp-server"
tok=$(curl -s "$TOKEN_URL" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).token))')

# 1. index 到底发布了哪些平台？
curl -s -H "Authorization: Bearer $tok" -H "Accept: application/vnd.oci.image.index.v1+json" \
  "$BASE/manifests/0.8.0" | node -e '...打印 manifests[].platform 与 digest...'

# 2. 读 child manifest 的 config blob，再逐层扫 .node 文件，打印 e_machine
```

`e_machine` 位于文件第 18 字节起、共两字节，按第 5 字节的 ELF data 标志决定字节序：`0x3e` 是 x86-64，
`0xb7` 是 AArch64，`0x28` 是 32 位 ARM。Mach-O 以 `cf fa ed fe` 或 `fe ed fa cf` 开头；Windows 的
DLL/EXE 以 `4d 5a`（`MZ`）开头。判断依据就只有这些。它并不要求文件完整 —— 这也是我们的工具只向 tar
读取器索取每个 `.node` 前 64 字节、而不是把几百 MB 模块体留在内存里的原因。

## 在我们自己的镜像里读到了什么

每个已发布标签，同一条命令，arm64 那一腿：

| 版本 | Registry 发布时间 | Layer 数 | 文件数 | `.node` 模块 | `elf_arch_mismatch` | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| 0.4.9 | 2026-08-10 | 16 | 11,101 | 4 | **0** | 正确：模块确实是 AArch64 |
| 0.5.0 | 2026-08-15 | - | - | - | - | 根本没有发布 `linux/arm64` child |
| 0.6.0 | 2026-08-28 | 18 | 21,129 | 8 | **4** | 错误：arm64 标签里是 x86-64 模块 |
| 0.7.0 | 2026-09-04 | 18 | 21,101 | 8 | **4** | 错误 |
| 0.8.0 | 2026-09-25 | 21 | 21,864 | 8 | **4** | 错误 |
| 0.8.0（`amd64`） | 2026-09-25 | 21 | 21,864 | 8 | **0** | 自洽 |

这张表里有三点值得注意。

第一，这是一次**回退**，不是我们一直以来的限制：0.4.9 的 arm64 标签带的是 arm64 二进制，而那个版本的
Docker 导出审查已经按名列出了它们（`skia.linux-arm64-gnu.node`、`linux-arm64-musl` 变体，以及一个与 amd64
摘要不同的 arm64 `better_sqlite3.node`）。字节读数与那张表一致 —— 这正是我们敢相信其中任意一方的唯一理由。

第二，**时间窗可以收窄到 0.5.0 到 0.6.0**。0.5.0 没发布 arm64 child；0.6.0 发布了，而它带的已经是错的树。
要修的人应该去看那个窗口里镜像 job 改了什么，而不是回头翻整段构建史。

第三，今天两个架构之间有 **12 个 layer 是共享的**，那就是被复制的 `/app` 留下的指纹。关于构建机制的这一句
只是推断；读数指的是 `e_machine` 的值。同样属于读数的还有一条：网关镜像 `ai-gateway-service:0.8.0` 的 arm64
一腿报出同样的 `elf_arch_mismatch=4`、同样的 21,864 个文件、`/app` 下同样的 277,037,069 字节。
这个仓库发布的两个镜像都带着它，而我们在首屏让访客跑的那条命令正是
`docker run … ai-gateway-service:0.8.0 pnpm gateway demo` —— 也就是说，Apple Silicon 用户撞上的失败是我们自己的，
不是假设出来的。

## 如果你也发布多平台 Node 镜像，便宜的检查清单

1. 不要让依赖树只安装一次然后复制给每个平台。在**每个平台的构建阶段内部**安装，或至少
   `pnpm rebuild better-sqlite3`。
2. 如果加不起第二台 runner，就只发布一个架构，并且说明。一个能用的单架构标签，好过一个只在纸面上
   双架构的标签，而且需要维护的声明严格更小。
3. 用字节验证，不要相信标签。这项检查的成本是每仓库一次匿名 token 请求加几百 MB 的 GET；
   `docker buildx` 无错完成只证明 manifest 写对了，不证明内容对得上。
4. 检查你原生包的 `optionalDependencies` 逻辑。如果 lockfile 只钉住一个平台的可选集合，
   单纯改成按架构安装并不会修好它。
5. 把平台参数写在读者真正执行命令的地方。我们在 README 和 60 秒快速开始里都告诉 Apple Silicon 用户加
   `--platform linux/amd64`，因为藏在审查页里的注意事项，等于在失败之后才被他读到的注意事项。

## 这些读数不能证明什么

不能证明 amd64 镜像是安全的，不能证明代码在运行时的行为，也不能证明不存在其它架构相关问题。
我们从头到尾没有执行镜像 —— 这恰恰是直接读 tarball 的意义：一个停住的容器仍然是容器，
而一个不运行任何东西的审查，不可能变成在别人机器上把事情搞坏的那一环。

它同样没有证明上面那个构建机制。共享 layer 加 x86-64 的 `e_machine` 值，与「一次安装被复制给两臂」是一致的；
要证明它得看构建，而修复的决定也必须在构建那里做。

相关：[MCP 镜像内容审查 0.8.0](https://github.com/happy520ai/unified-ai-system/blob/master/docs/security/mcp-image-review-0.8.0.md)、
[0.8.0 已发布镜像的工具清单](verify-mcp-docker-image.html)、
[issue #190](https://github.com/happy520ai/unified-ai-system/issues/190)。
