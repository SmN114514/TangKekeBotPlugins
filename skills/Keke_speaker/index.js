import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

let cfg = () => ({});

export function setup(api) {
  cfg = api.config;

  api.registerTool({
    id: 'speak_as_keke',
    name: '用唐可可的声音说话',
    description: '把一段中文文本用唐可可的声音合成语音并发到当前会话。当你想用语音而不是文字说话时使用；也可以在被要求"说句话""发条语音"时使用。参数 text 是要说的话。',
    category: 'media',
    icon: '🎤',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要用唐可可声音说出来的中文文本，建议一句话以内' }
      },
      required: ['text']
    },
    async execute(ctx, args) {
      const text = String(args?.text ?? '').trim();
      if (!text) return { content: '缺少 text 参数', isError: true };
      if (text.length > 100) return { content: '文本太长，控制在 100 字以内', isError: true };

      const c = cfg();
      const apiKey = String(c.apiKey || '').trim();
      const workspaceId = String(c.workspaceId || '').trim();
      const voiceId = String(c.voiceId || '').trim();
      const model = String(c.model || 'qwen-audio-3.0-tts-flash').trim();

      if (!apiKey || !workspaceId || !voiceId) {
        return { content: 'TTS 配置不完整，请在「技能」页填好 API Key、Workspace ID、音色 ID', isError: true };
      }

      try {
        // 第一步：请求合成，拿到音频临时 URL
        const ttsUrl = `https://${workspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`;
        const ttsResp = await axios.post(
          ttsUrl,
          { model, input: { text }, parameters: { voice: voiceId } },
          { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
        );

        const audioUrl = ttsResp.data?.output?.audio?.url;
        if (!audioUrl) return { content: 'TTS 没有返回音频地址', isError: true };

        // 第二步：下载音频到临时文件
        const audioResp = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const tmpFile = path.join(os.tmpdir(), `keke-${Date.now()}.wav`);
        fs.writeFileSync(tmpFile, audioResp.data);

        // 第三步：通过 sender 发出去（自带队列/限频/去重）
        await ctx.sender.sendMedia(ctx.chatKey, [
          { type: 'record', data: { file: tmpFile } }
        ], { label: '[语音]' });

        // 第四步：清掉临时文件
        try { fs.unlinkSync(tmpFile); } catch {}

        return { content: `已用唐可可的声音发出语音：${text}` };
      } catch (error) {
        const msg = error?.response?.data
          ? Buffer.from(error.response.data).toString().slice(0, 300)
          : (error?.message ?? String(error));
        return { content: `语音合成失败：${msg}`, isError: true };
      }
    }
  });
}