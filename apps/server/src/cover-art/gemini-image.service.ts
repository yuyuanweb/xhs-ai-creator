import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetch, ProxyAgent, type Dispatcher } from 'undici';

export interface ImageInput {
  data: Buffer;
  mime: string;
}

export interface GenerateImageOptions {
  aspectRatio: string;
  /** 一起交给模型的参考图 */
  references?: ImageInput[];
}

/** 参考图只收这几种，GIF、AVIF 会被接口直接拒掉 */
export const GEMINI_INPUT_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** 开着深度思考的 2K 图，一张常要三五十秒 */
const TIMEOUT_MS = 180_000;

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType?: string; data?: string };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

/**
 * Gemini 生图（Nano Banana）走 generateContent，只要图片输出。
 * Node 自带的 fetch 不认 HTTPS_PROXY，国内连 Google 要显式挂代理
 */
@Injectable()
export class GeminiImageService {
  private readonly logger = new Logger(GeminiImageService.name);
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly imageSize: string;
  private readonly thinkingLevel: string;
  private readonly dispatcher?: Dispatcher;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY', '');
    const base = config
      .get<string>('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com')
      .replace(/\/+$/, '')
      .replace(/\/v1beta$/, '');
    const model = config.get<string>('GEMINI_IMAGE_MODEL', 'gemini-3.1-flash-image-preview');
    this.endpoint = `${base}/v1beta/models/${model}:generateContent`;
    this.imageSize = config.get<string>('GEMINI_IMAGE_SIZE', '2K');
    this.thinkingLevel = config.get<string>('GEMINI_IMAGE_THINKING', 'high');
    const proxy = config.get<string>('GEMINI_PROXY') || config.get<string>('HTTPS_PROXY') || config.get<string>('https_proxy');
    this.dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
  }

  async generate(prompt: string, opts: GenerateImageOptions): Promise<ImageInput> {
    if (!this.apiKey) throw new InternalServerErrorException('服务端还没配置 GEMINI_API_KEY，暂时不能生成封面图');

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...(opts.references ?? []).map((r) => ({ inlineData: { mimeType: r.mime, data: r.data.toString('base64') } })),
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: opts.aspectRatio, imageSize: this.imageSize },
        ...(this.thinkingLevel ? { thinkingConfig: { thinkingLevel: this.thinkingLevel } } : {}),
      },
    };

    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(body),
        dispatcher: this.dispatcher,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new InternalServerErrorException(describeNetworkError(err));
    }

    const json = (await res.json().catch(() => null)) as GeminiResponse | null;
    if (!res.ok) {
      this.logger.warn(`Gemini 生图失败 ${res.status}：${json?.error?.message ?? '无返回内容'}`);
      throw new InternalServerErrorException(describeHttpError(res.status, json?.error?.message));
    }

    const image = pickImage(json);
    if (!image) {
      const reason = json?.promptFeedback?.blockReason ?? json?.candidates?.[0]?.finishReason ?? '未知';
      this.logger.warn(`Gemini 没有返回图片：${reason}`);
      throw new InternalServerErrorException(`模型没有画出图片（${reason}），多半是被安全过滤拦了，换个说法或换张参考图再试`);
    }
    return image;
  }
}

/** 开了思考时前面几个 part 是草稿图，跳过它们取最终那张 */
function pickImage(json: GeminiResponse | null): ImageInput | null {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const part = parts.find((p) => !p.thought && p.inlineData?.data);
  if (!part?.inlineData?.data) return null;
  return { data: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType ?? 'image/png' };
}

function describeHttpError(status: number, message?: string): string {
  if (status === 401 || status === 403) return 'Gemini 鉴权失败：检查 GEMINI_API_KEY';
  if (status === 429) return '生图额度用完或请求太频繁，稍等一会儿再试';
  if (status === 404) return '生图模型不存在：检查 GEMINI_IMAGE_MODEL';
  return `生图接口报错（${status}）：${message ?? '没有返回原因'}`;
}

function describeNetworkError(err: unknown): string {
  const message = err instanceof Error ? err.message : '未知错误';
  if (/timeout|aborted/i.test(message)) return '生图超时，再点一次试试';
  return `连不上 Gemini（${message}）：国内需要配置 GEMINI_PROXY 或可用的 GEMINI_BASE_URL`;
}
