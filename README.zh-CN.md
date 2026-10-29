<p align="center">
  <img src="docs/images/l-keycap.svg" width="96" alt="LaTeX Coder 键帽 Logo">
</p>

<h1 align="center">不是另一个 Overleaf，<br>是更好的那个。</h1>

<p align="center"><strong>LaTeX Coder</strong> 是开源的 LaTeX 协作编辑器，为现在的论文写作方式而生：<br>你、合作者、AI 编程智能体和 Git，在同一份源码上协作。</p>

<p align="center">
  <a href="https://evoevolver.github.io/LatexCoder/">官网</a> ·
  <a href="README.md">English</a> ·
  <a href="README.md#quick-start">完整文档</a>
</p>

<p align="center">
  <a href="https://railway.com/deploy/latexcoder?referralCode=4KUZ4o&amp;utm_medium=integration&amp;utm_source=template&amp;utm_campaign=generic"><img src="https://railway.com/button.svg" alt="一键部署到 Railway"></a>
</p>

![LaTeX Coder 中文界面：文件树、源码、修订建议和 PDF 预览](marketing/shots/zh-CN/workspace.png)

## 为什么换

| | 别处 | LaTeX Coder |
| --- | --- | --- |
| **修订 / 批注** | 往往是付费功能 | 人人可用，审阅记录以 LaTeX 宏的形式存在源码里 |
| **Git** | 付费桥接，历史被压成一条线 | 每篇论文本身就是 Git 仓库：SSH 克隆、推送、合并、回滚 |
| **AI 改稿** | 复制到聊天框再粘回来 | 把一条命令交给 Claude Code、Codex 等智能体，直接安全地改实时论文 |
| **协作者** | 需要账号，人数受套餐限制 | 查看 / 编辑链接，访客免注册，不限人数 |
| **数据** | 放在别人的云上 | 普通文件 + Git 仓库，存在你自己的服务器 |
| **编译** | 免费版有时间限制 | 完整 TeX Live（pdfLaTeX / XeLaTeX / LuaLaTeX）和 Tectonic，用你自己的算力 |

## 让 AI 直接进论文里改

在「协作 → 智能体编辑」里复制命令交给智能体。它会拿到这个项目专属的纯文本说明书（文件、搜索、编译、署名、审阅、Git），并按一个刻意简单的协议修改：

1. 下载要改的文件；
2. 用普通的本地工具修改；
3. 连同原始内容哈希一起上传。

如果这期间有合作者改过该文件，上传会被拒绝，而不是覆盖别人的工作。切换到 **「提出建议」** 模式后，AI 的每一处改动都会变成修订，由你逐条接受或拒绝。

## 写起来更顺手

- **悬停预览**：鼠标放在 `\ref`、`\eqref` 上就能看到对应公式或图片，跨文件也行；放在 `\cite` 上看文献标题和作者。
- **⌘ + 点击跳转**：跳到 label、BibTeX 条目或被 `\input` 的文件。
- **字符级署名（Blame）**：每段文字是谁写的、来自哪次 Git 提交。
- **SyncTeX 双向定位**：源码 ↔ PDF。
- **分章节编译**：毕业论文只编译当前这一章。
- **日志直达错误**：第一个致命错误一键跳回源码行。
- **全项目搜索替换**、**引用自动补全**、**历史版本一键恢复**、**手机端可用**。
- **中文 / English / 日本語 界面**。

## 快速开始

最省事：点上面的 **Deploy on Railway**，挂载 `/data` 卷并设置 `LATEXCODER_ADMIN_PASSWORD`。

自己的服务器：

```sh
git clone https://github.com/EvoEvolver/LatexCoder && cd LatexCoder
docker build -t latexcoder .
docker volume create latexcoder-data
docker run --rm -p 8090:8080 -p 2222:2222 \
  --security-opt seccomp=unconfined \
  -e LATEXCODER_ADMIN_PASSWORD='换成一个足够长的随机密码' \
  -v latexcoder-data:/data latexcoder
```

打开 <http://127.0.0.1:8090>，用 `admin` 和上面的密码登录，再从管理面板生成邀请链接发给合作者。首次启动会在后台把完整 TeX Live 装到数据卷里（需要几分钟），期间 Tectonic 编译可以正常使用。

本地开发需要 Node.js 22+、pnpm 10+ 和 Git：

```sh
pnpm install
LATEXCODER_ADMIN_PASSWORD='use-a-long-random-password' pnpm start
```

中文论文（`ctex`）需要 XeLaTeX：编译器选 latexmk 时，在项目根目录放一个 `latexmkrc`，写入 `$pdflatex = 'xelatex %O %S';` 即可。Tectonic 本身基于 XeTeX 引擎。

部署、Git、编译、配置项和安全模型的完整说明见 [英文 README](README.md)。

## 许可证

[MIT](LICENSE)
