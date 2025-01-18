import type { Neuri } from 'neuri'
import type { ChatHistory } from './types'

import { useLogg } from '@guiiai/logg'
import { system, user } from 'neuri/openai'

import { genChatAgentPrompt } from '../../utils/prompt'
import { toRetriable } from '../../utils/reliability'

const logger = useLogg('chat-llm').useGlobalConfig()

interface LLMChatConfig {
  agent: Neuri
  model?: string
  retryLimit?: number
  delayInterval?: number
  maxContextLength?: number
}

export async function generateChatResponse(
  message: string,
  history: ChatHistory[],
  config: LLMChatConfig,
): Promise<string> {
  const systemPrompt = genChatAgentPrompt()
  const chatHistory = formatChatHistory(history, config.maxContextLength ?? 10)
  const userPrompt = message

  const messages = [
    system(systemPrompt),
    ...chatHistory,
    user(userPrompt),
  ]

  const content = await config.agent.handleStateless(messages, async (c) => {
    logger.log('Generating response...')

    const handleCompletion = async (c: any): Promise<string> => {
      const completion = await c.reroute('chat', c.messages, {
        model: config.model ?? 'openai/gpt-4-mini',
      })

      if (!completion || 'error' in completion) {
        logger.withFields(c).error('Completion failed')
        throw new Error(completion?.error?.message ?? 'Unknown error')
      }

      const content = await completion.firstContent()
      logger.withFields({ usage: completion.usage, content }).log('Response generated')
      return content
    }

    const retriableHandler = toRetriable<any, string>(
      config.retryLimit ?? 3,
      config.delayInterval ?? 1000,
      handleCompletion,
    )

    return await retriableHandler(c)
  })

  if (!content) {
    throw new Error('Failed to generate response')
  }

  return content
}

function formatChatHistory(
  history: ChatHistory[],
  maxLength: number,
): Array<{ role: 'user' | 'assistant', content: string }> {
  // Take the most recent messages up to maxLength
  const recentHistory = history.slice(-maxLength)

  return recentHistory.map(entry => ({
    role: entry.sender === 'bot' ? 'assistant' : 'user',
    content: entry.message,
  }))
}
