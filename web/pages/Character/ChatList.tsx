import { A, useNavigate, useParams } from '@solidjs/router'
import { Component, createEffect, createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { AllChat, characterStore, chatStore } from '../../store'
import PageHeader from '../../shared/PageHeader'
import { Edit, Import, Plus, SortAsc, SortDesc, Trash } from 'lucide-solid'
import CreateChatModal from './CreateChat'
import ImportChatModal from './ImportChat'
import { setComponentPageTitle, toDuration } from '../../shared/util'
import { ConfirmModal } from '../../shared/Modal'
import AvatarIcon from '../../shared/AvatarIcon'
import { AppSchema } from '../../../srv/db/schema'
import Select from '../../shared/Select'
import Divider from '../../shared/Divider'
import TextInput from '../../shared/TextInput'
import Button from '../../shared/Button'
import CharacterSelect from '../../shared/CharacterSelect'
import {
  ChatCharacter,
  ChatLine,
  SortDirection,
  SortType,
  getListCache,
  groupAndSort,
  saveListCache,
} from './util'

const sortOptions = [
  { value: 'chat-updated', label: 'Chat Activity', kind: 'chat' },
  { value: 'bot-activity', label: 'Bot Activity', kind: 'chat' },
  { value: 'chat-created', label: 'Chat Created', kind: 'chat' },
  { value: 'character-name', label: 'Bot Name', kind: 'bot' },
  { value: 'character-created', label: 'Bot Created', kind: 'bot' },
]

const CharacterChats: Component = () => {
  const params = useParams()
  const cache = getListCache()
  const state = chatStore((s) =>
    (s.all?.chats || [])?.map((chat) => ({
      _id: chat._id,
      name: chat.name,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      characters: toChatListState(s.all?.chars || {}, chat),
    }))
  )
  const chars = characterStore((s) => ({
    list: s.characters.list,
    loaded: s.characters.loaded,
  }))

  const nav = useNavigate()
  const [search, setSearch] = createSignal('')
  const [charId, setCharId] = createSignal<string | undefined>(params.id)
  const [showCreate, setCreate] = createSignal(false)
  const [showImport, setImport] = createSignal(false)
  const [sortField, setSortField] = createSignal(cache.sort.field)
  const [sortDirection, setSortDirection] = createSignal(cache.sort.direction)

  createEffect(() => {
    if (!params.id) {
      setComponentPageTitle(`Chats`)
      return
    }

    const char = chars.list.find((c) => c._id === params.id)
    setComponentPageTitle(char ? `${char.name} chats` : 'Chats')
  })

  createEffect(() => {
    const next = {
      sort: {
        field: sortField(),
        direction: sortDirection(),
      },
    }

    saveListCache(next)
  })

  createEffect(() => {
    if (!charId()) return
    if (sortField() === 'character-name' || sortField() === 'character-created') {
      setSortField('chat-updated')
    }
  })

  const chats = createMemo(() => {
    const filterCharId = charId()

    return state.filter((chat) => {
      if (filterCharId && !chat.characters.some((c) => c._id === filterCharId)) return false
      const trimmed = search().trim().toLowerCase()
      if (!trimmed) return true
      if (chat.name.toLowerCase().includes(trimmed)) return true
      if (chat.characters.some((c) => c.name.toLowerCase().includes(trimmed))) return true
      if (chat.characters.some((c) => c.description.toLowerCase().includes(trimmed))) return true
      return false
    })
  })

  onMount(() => {
    if (!chars.loaded) {
      characterStore.getCharacters()
    }

    chatStore.getAllChats()
  })

  const Options = () => (
    <>
      <Show when={!!params.id}>
        <button
          class={`btn-primary w-full items-center justify-start py-2 sm:w-fit sm:justify-center`}
          onClick={() => nav(`/character/${params.id}/edit`)}
        >
          <Edit /> <span class="hidden sm:inline">Edit</span>
        </button>
      </Show>
      <button
        class={`btn-primary w-full items-center justify-start py-2 sm:w-fit sm:justify-center`}
        onClick={() => setCreate(true)}
      >
        <Plus /> <span class="hidden sm:inline">New</span>
      </button>
    </>
  )

  return (
    <div class="flex flex-col gap-2">
      <PageHeader
        title={
          <div class="flex w-full justify-between">
            <div>Chats</div>
            <div class="flex gap-1 text-base">
              <Options />
            </div>
          </div>
        }
      />

      <div class="mb-2 flex justify-between">
        <div class="flex flex-wrap">
          <div class="m-1 ml-0">
            <TextInput
              fieldName="search"
              placeholder="Search..."
              onKeyUp={(ev) => setSearch(ev.currentTarget.value)}
            />
          </div>

          <CharacterSelect
            class="w-48"
            fieldName="char"
            items={chars.list}
            emptyLabel="All Characters"
            value={charId()}
            onChange={(char) => setCharId(char?._id)}
          />

          <div class="flex flex-wrap">
            <Select
              class="m-1 bg-[var(--bg-600)]"
              fieldName="sortBy"
              items={sortOptions.filter((opt) => (charId() ? opt.kind === 'chat' : true))}
              value={sortField()}
              onChange={(next) => setSortField(next.value as SortType)}
            />

            <div class="py-1">
              <Button
                schema="secondary"
                class="rounded-xl"
                onClick={() => {
                  const next = sortDirection() === 'asc' ? 'desc' : 'asc'
                  setSortDirection(next as SortDirection)
                }}
              >
                {sortDirection() === 'asc' ? <SortAsc /> : <SortDesc />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Show
        when={chats().length}
        fallback={<NoChats character={chars.list.find((c) => c._id === params.id)?.name} />}
      >
        <Chats
          chats={chats()}
          chars={chars.list}
          sortField={sortField()}
          sortDirection={sortDirection()}
          charId={charId()}
        />
      </Show>
      <CreateChatModal show={showCreate()} close={() => setCreate(false)} charId={charId()} />
      <ImportChatModal
        show={showImport()}
        close={() => setImport(false)}
        char={chars.list.find((c) => c._id === charId())}
      />
    </div>
  )
}

const Chats: Component<{
  chats: ChatLine[]
  chars: AppSchema.Character[]
  sortField: SortType
  sortDirection: SortDirection
  charId?: string
}> = (props) => {
  const [showDelete, setDelete] = createSignal('')

  const groups = createMemo(() => {
    const filteredCharId = props.charId
    let chars = props.chars

    if (filteredCharId) {
      chars = props.chars.filter((c) => c._id === filteredCharId)
    }

    return groupAndSort(chars, props.chats, props.sortField, props.sortDirection)
  })

  const confirmDelete = () => {
    chatStore.deleteChat(showDelete(), () => setDelete(''))
  }

  return (
    <div class="flex flex-col gap-2">
      <For each={groups()}>
        {({ char, chats }) => (
          <>
            <div class="flex flex-col gap-2">
              <Show when={char}>
                <div class="font-bold">{char!.name}</div>
              </Show>
              <Show when={chats.length === 0}>
                <div>No conversations</div>
              </Show>
              <For each={chats}>
                {(chat) => (
                  <div class="flex w-full justify-between gap-2 rounded-lg bg-[var(--bg-800)] p-1 hover:bg-[var(--bg-700)]">
                    <A
                      class="flex w-10/12 cursor-pointer gap-2 sm:w-11/12"
                      href={`/chat/${chat._id}`}
                    >
                      <div class="ml-4 flex items-center">
                        <div class="relative flex-shrink-0">
                          <For each={chat.characters.slice(0, 3).reverse()}>
                            {(char, i) => {
                              const positionStyle = getAvatarPositionStyle(chat, i)
                              if (positionStyle === undefined) return

                              return (
                                <div
                                  class={`absolute top-1/2 -translate-y-1/2 transform ${positionStyle}`}
                                >
                                  <AvatarIcon avatarUrl={char.avatar} />
                                </div>
                              )
                            }}
                          </For>
                        </div>
                      </div>

                      <div class="flex max-w-[90%] flex-col justify-center gap-0 pl-14">
                        <div class="overflow-hidden text-ellipsis whitespace-nowrap font-bold leading-5">
                          {chat.characters.map((c) => c.name).join(', ')}
                        </div>
                        <div class="overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-4">
                          {chat.name || 'Untitled'}
                        </div>
                        <div class="flex text-xs italic text-[var(--text-600)]">
                          Updated {toDuration(new Date(chat.updatedAt))} ago.
                        </div>
                      </div>
                    </A>
                    <div class="flex items-center px-2" onClick={() => setDelete(chat._id)}>
                      <Trash size={20} class="icon-button" />
                    </div>
                  </div>
                )}
              </For>
            </div>
            <Divider />
          </>
        )}
      </For>
      <ConfirmModal
        show={!!showDelete()}
        close={() => setDelete('')}
        confirm={confirmDelete}
        message="Are you sure wish to delete the conversation?"
      />
    </div>
  )
}

const NoChats: Component<{ character?: string }> = (props) => (
  <div class="mt-4 flex w-full justify-center text-xl">
    <div>
      <Show when={!props.character}>You have no conversations yet.</Show>
      <Show when={props.character}>
        You have no conversations with <i>{props.character}</i>.
      </Show>
    </div>
  </div>
)

export default CharacterChats

function getAvatarPositionStyle(chat: ChatLine, i: () => number) {
  if (chat.characters.length === 1) {
    return ''
  }
  if (chat.characters.length === 2) {
    return i() === 0 ? 'translate-x-1/4 ' : '-translate-x-1/4 '
  }
  if (chat.characters.length >= 3) {
    return i() === 0 ? 'translate-x-1/4 ' : i() === 1 ? '' : '-translate-x-1/4 '
  }
  return
}

function toCharacterIds(characters?: Record<string, boolean>) {
  if (!characters) return []

  const ids: string[] = []
  for (const [id, enabled] of Object.entries(characters)) {
    if (enabled) ids.push(id)
  }
  return ids
}

function toChatListState(chars: Record<string, AppSchema.Character>, chat: AllChat) {
  const charIds = [chat.characterId].concat(toCharacterIds(chat.characters))

  const rows: ChatCharacter[] = []
  for (const id of charIds) {
    const char = chars[id]
    if (!char) {
      rows.push({ _id: '', name: 'Unknown', description: '', avatar: '' })
      continue
    }

    rows.push({
      _id: char._id,
      name: char.name,
      description: char.description || '',
      avatar: char.avatar,
    })
  }

  return rows
}
