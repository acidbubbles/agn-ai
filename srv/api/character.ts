import { Router } from 'express'
import { assertValid } from 'frisker'
import { v4 } from 'uuid'
import { store } from '../db'
import { logger } from '../logger'
import { handle, StatusError } from './handle'
import { handleUpload } from './upload'

const router = Router()

const valid = {
  name: 'string',
  avatar: 'string?',
  scenario: 'string',
  greeting: 'string',
  sampleChat: 'string',
  persona: {
    kind: ['wpp', 'sbf', 'json', 'boostyle'],
    attributes: 'any',
  },
} as const

const createCharacter = handle(async (req) => {
  const body = await handleUpload(req, { ...valid, persona: 'string' })
  const persona = JSON.parse(body.persona)
  logger.warn({ body, persona }, 'Creating')
  assertValid(valid.persona, persona)

  const [file] = body.attachments
  const avatar = file ? file.filename : undefined

  const char = await store.characters.createCharacter({
    name: body.name,
    persona,
    sampleChat: body.sampleChat,
    scenario: body.scenario,
    avatar,
    greeting: body.greeting,
  })

  return char
})

const getCharacters = handle(async () => {
  const chars = await store.characters.getCharacters()
  return { characters: chars }
})

const editCharacter = handle(async ({ params, body }) => {
  assertValid(valid, body)
  const id = params.id
  const char = await store.characters.updateCharacter(id, body)
  return char
})

const getCharacter = handle(async ({ params }) => {
  const char = await store.characters.getCharacter(params.id)
  if (!char) {
    throw new StatusError('Character not found', 404)
  }
  return char
})

const deleteCharacter = handle(async ({ params }) => {
  const id = params.id
  await store.characters.deleteCharacter(id)
  return { success: true }
})

router.post('/', createCharacter)
router.get('/', getCharacters)
router.post('/:id', editCharacter)
router.get('/:id', getCharacter)
router.delete('/:id', deleteCharacter)

export default router
