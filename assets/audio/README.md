# HTTI 音频素材与处理记录

两份音频随项目本地分发，页面运行时不连接素材网站。原始音频由下列作者制作，HTTI 做了剪辑、混音和编码。

| 项目文件 | 原始素材及作者 | 授权 | 处理 |
|---|---|---|---|
| `dread-loop.mp3` | [Ambient Horror Track 01](https://opengameart.org/content/ambient-horror-track-01)，Cleyton Kauffman（[作者主页](https://soundcloud.com/cleytonkauffman)） | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 48 秒原曲去除 35 Hz 以下频段；首尾 0.75 秒循环交叉淡化；电平归一化；47.25 秒、44.1 kHz 双声道 MP3，160 kbps |
| `jumpscare.mp3` | [Horror Hit Soundpack 1](https://opengameart.org/content/horror-hit-soundpack-1)，psychhead_；使用 `Mid 7.wav`、`High 6.wav`、`Bassy 5.wav` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 去除起始静音；三层混合；50 Hz 高通、7.5 kHz 低通；软饱和、3 ms 起音和末尾 120 ms 淡出；0.62 秒、44.1 kHz 双声道 MP3，192 kbps |

授权核对日期：2026-11-28。两个来源页面明确标注 CC0；环境音压缩包中的 `readme.txt` 同样注明 CC0。保留作者信息以便追溯。

## 重建素材

下载原始压缩包，分别命名为：

- `ambience.zip`：[官方下载](https://opengameart.org/sites/default/files/ambient_horror_track_01_0.zip)，SHA-256 `b08345334b3178e6d340328787f7edefef8fde6545c86e8487a18d567e31671f`
- `hits.zip`：[官方下载](https://opengameart.org/sites/default/files/horror_hit_soundpack_1.zip)，SHA-256 `4bbdba64225d2ad2f5d23a04d71ccb18e6567c42f972a7f2dcb66d8acc5ed4f3`

安装 Python 的 NumPy、SciPy，并准备 ffmpeg 后运行：

```powershell
python tools/prepare-audio.py <压缩包目录> <ffmpeg可执行文件路径>
```

脚本先核对压缩包哈希，再重建素材。原始包约 34.5 MB，不加入仓库；最终两份音频合计约 940 KiB。不同 ffmpeg 版本的编码结果可能不同。

## 播放行为

首次用户手势后请求并解码本地采样；合成底声立即启动，采样就绪后淡入。背景随题目进度增加亮度、层次和音量，结果页收低。主突脸把背景短暂压低，再播放短采样和低频冲击。结束或取消突发效果时恢复背景。

静音会关闭 AudioContext；切后台暂停背景并取消一次性音效，回前台恢复背景而不重播刚才的惊吓。采样独立加载，下载或解码失败、超过 12 秒未完成时使用合成音回退；重新开启声音时可重试失败项。直接以 `file://` 打开使用合成音；完整采样效果请通过本地 HTTP 预览。

## 本地验证（2026-11-28）

- Node 回归测试 51 项通过，其中音频测试 10 项；覆盖独立加载、超时重试、迟到请求、取消时的音量连续性和既有生命周期行为。
- 本机 Edge 实际 Web Audio 输出以 48 kHz 双声道录制：本次测试峰值约 −2.4 dBFS，削波样本数为 0；静音后 context 关闭，重开正常播放已缓存的采样。
- Edge 解码背景长度 47.25 秒，循环边界最大样本跳变约 0.0000038；测试页的音频播放与正式问卷的资源加载、作答、静音均正常。
- 以上验证说明播放和电平正常；主观恐怖程度仍取决于听者、耳机或扬声器以及设备音量。
