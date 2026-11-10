import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AgentMessage, AgentStepResponse } from '@rcs/shared';

const MAX_OUTPUT_TOKENS = 8192;

export interface ChatOptions {
  model?: string;
  /** 要求模型只输出 JSON。不是所有厂商都支持，不支持时退回靠提示词约束 */
  jsonMode?: boolean;
  temperature?: number;
}

/**
 * 所有厂商统一走 OpenAI 兼容协议，换模型只改环境变量里的 baseURL / key / model。
 * 这样同一篇文章可以用不同模型跑同一套提示词做横向对比。
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(config: ConfigService) {
    this.client = new OpenAI({
      baseURL: normalizeBaseUrl(config.get<string>('LLM_BASE_URL')),
      apiKey: config.get<string>('LLM_API_KEY') ?? '',
      timeout: 180_000,
      maxRetries: 1,
    });
    this.defaultModel = config.get<string>('LLM_MODEL', 'gpt-4o-mini');
  }

  async chat(messages: AgentMessage[], opts: ChatOptions = {}): Promise<AgentStepResponse> {
    let res: OpenAI.Chat.ChatCompletion;
    try {
      res = await this.client.chat.completions.create({
        model: opts.model || this.defaultModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content ?? '' })),
        temperature: opts.temperature ?? 0.7,
        // 初稿很长，厂商默认的输出上限会把 JSON 截成半截
        max_tokens: MAX_OUTPUT_TOKENS,
        ...(opts.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      });
    } catch (err) {
      throw new InternalServerErrorException(describeLlmError(err));
    }

    const choice = res.choices[0];
    if (!choice) throw new InternalServerErrorException('模型没有返回内容');

    return {
      message: {
        role: 'assistant',
        content: choice.message.content ?? undefined,
      },
      finishReason: choice.finish_reason === 'length' ? 'length' : 'stop',
      usage: res.usage
        ? { promptTokens: res.usage.prompt_tokens, completionTokens: res.usage.completion_tokens }
        : undefined,
    };
  }

  /** 模型偶尔会把 JSON 包在代码围栏里，或者在前后多说两句 */
  parseJson<T>(raw: string | undefined): T {
    if (!raw) throw new InternalServerErrorException('模型返回为空');

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced?.[1] ?? raw;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1) {
      this.logger.error(`模型输出里找不到 JSON：${raw.slice(0, 500)}`);
      throw new InternalServerErrorException('模型没有返回可解析的 JSON，请重试或换个模型');
    }

    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      this.logger.error(`JSON 解析失败：${candidate.slice(0, 500)}`);
      throw new InternalServerErrorException('模型返回的 JSON 格式有误，请重试');
    }
  }
}

/** 通义只写了主机名时，补上 OpenAI 兼容路径，否则会打到不存在的 /chat/completions */
function normalizeBaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const url = raw.replace(/\/+$/, '');
  if (/dashscope(-intl)?\.aliyuncs\.com$/i.test(url)) return `${url}/compatible-mode/v1`;
  return url;
}

function describeLlmError(err: unknown): string {
  const status = (err as { status?: number }).status;
  const message = err instanceof Error ? err.message : '未知错误';
  if (status === 404) {
    return '大模型接口 404：检查 LLM_BASE_URL 是否是 OpenAI 兼容地址（通义应为 …/compatible-mode/v1）';
  }
  if (status === 401) return '大模型鉴权失败：检查 LLM_API_KEY';
  if (/timeout|timed out|aborted/i.test(message)) return '大模型响应超时，点「生成初稿」再试一次';
  return `调用大模型失败：${message}`;
}
