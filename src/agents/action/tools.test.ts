import { messages, system, user } from 'neuri/openai'
import { beforeAll, describe, expect, it } from 'vitest'

import { initBot, useBot } from '../../composables/bot'
import { botConfig, initEnv } from '../../composables/config'
import { sleep } from '../../utils/helper'
import { initLogger } from '../../utils/logger'
import { generateActionAgentPrompt } from '../prompt/llm-agent.plugin'
import { initAgent } from './llm'

describe('actions agent', { timeout: 0 }, () => {
  beforeAll(() => {
    initLogger()
    initEnv()
    initBot({ botConfig })
  })

  it('should choose right query command', async () => {
    const { bot } = useBot()
    const agent = await initAgent(bot)

    await new Promise<void>((resolve) => {
      bot.bot.once('spawn', async () => {
        const text = await agent.handle(messages(
          system(generateActionAgentPrompt(bot)),
          user('What\'s your status?'),
        ), async (c) => {
          const completion = await c.reroute('query', c.messages, { model: 'openai/gpt-4o-mini' })
          return await completion?.firstContent()
        })

        expect(text?.toLowerCase()).toContain('position')

        resolve()
      })
    })
  })

  it('should choose right action command', async () => {
    const { bot } = useBot()
    const agent = await initAgent(bot)

    await new Promise<void>((resolve) => {
      bot.bot.on('spawn', async () => {
        const text = await agent.handle(messages(
          system(generateActionAgentPrompt(bot)),
          user('goToPlayer: luoling8192'),
        ), async (c) => {
          const completion = await c.reroute('action', c.messages, { model: 'openai/gpt-4o-mini' })

          return await completion?.firstContent()
        })

        expect(text).toContain('goToPlayer')

        await sleep(10000)
        resolve()
      })
    })
  })
})
