# HTTI · 虚界投影

一个单文件静态网站：32 题主测试 + 4 段“她”的对话 + 双账本 + 十六型虚界投影。

## 本地预览

直接双击 `index.html` 即可。若浏览器限制本地文件的部分功能，可在本目录运行：

```bash
python -m http.server 8000
```

然后打开 `http://localhost:8000/`。

## 部署

这是一个纯静态站点，没有构建步骤、没有外部依赖。

- **GitHub Pages**：新建仓库，把本文件夹内容上传到根目录；Settings → Pages → Deploy from a branch → `main` / `/ (root)`。
- **Netlify Drop**：把整个 `HTTI-Website` 文件夹拖到 Netlify Drop。
- **Vercel**：导入文件夹，Framework Preset 选 `Other`，Output Directory 保持 `.`。
- **任意静态服务器**：把 `index.html` 放到站点根目录即可。

部署在子路径（例如 `/htti/`）也不需要改路径，所有 CSS、JS、图标都内联在 `index.html` 里。

## 说明

- 命名已统一为 **虚界投影**（原“怪物命格”）。
- 环境音默认关闭：右上角「♪ 环境音」，或按 **M** 键开关。
- 用户 ID 只用于页面内的最终台词与结果页，不会上传到任何服务器。
- 第 7 题环境渐暗，背景眼睛最初全部闭合，随进度逐只睁开；开头有「胆小慎入」提示。
- 恐怖元素包含闪烁、阴影、眼睛与画面变化。
- 娱乐向概念测试，不构成心理测量或诊断。

## 文件

- `index.html`：完整站点，单文件。
- `README.md`：本说明。