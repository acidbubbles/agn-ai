import nunjucks from 'nunjucks'
import { PromptOpts, BOT_REPLACE, SELF_REPLACE, PromptParts } from './prompt'

// Create a new environment and configure it
const env = new nunjucks.Environment()

env.addFilter('removeLineBreaks', function (str: string) {
  if (typeof str !== 'string') return str
  return str.replace(/(\r\n|\n|\r)/gm, ' ')
})

export const HISTORY_PLACEHOLDER = '\u204A'

export function processTemplate(template: string, opts: PromptOpts, parts: PromptParts) {
  const char = opts.replyAs.name
  const user = opts.impersonate
    ? opts.impersonate.name
    : opts.members.find((mem) => mem.userId === opts.chat.userId)?.handle || 'You'

  // Render the template with your variables
  const rendered = env.renderString(template, {
    br: '\n',
    char,
    user,
    scenario: fillPlaceholders(opts.chat.scenario, char, user),
    persona: parts.persona,
    memory: 'The clerk remembers that the customer is a regular',
    memories: opts.book?.entries,
    example_dialogue: fillPlaceholders(opts.char.sampleChat, char, user),
    history: HISTORY_PLACEHOLDER,
  })

  return rendered.replace(/\n\n/g, '\n').replace('{br}', '\n')
}

export function fillPlaceholders(str: string, char: string, user: string) {
  return str.replace(BOT_REPLACE, char).replace(SELF_REPLACE, user)
}
