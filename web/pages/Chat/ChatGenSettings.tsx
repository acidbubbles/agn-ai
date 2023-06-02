import { Save, X } from 'lucide-solid'
import { Component, createMemo, createSignal, For, Match, Show, Switch } from 'solid-js'
import {
  chatGenSettings,
  defaultPresets,
  getFallbackPreset,
  isDefaultPreset,
} from '../../../common/presets'
import { AppSchema } from '../../../srv/db/schema'
import Button from '../../shared/Button'
import Select from '../../shared/Select'
import GenerationSettings from '../../shared/GenerationSettings'
import Modal from '../../shared/Modal'
import { getStrictForm, parseGenSettingsOrder } from '../../shared/util'
import { chatStore, toastStore, userStore } from '../../store'
import { presetStore } from '../../store'
import { getAdapter } from '../../../common/prompt'
import { AIAdapter, AI_ADAPTERS } from '../../../common/adapters'
import { AutoPreset, getPresetOptions } from '../../shared/adapter'
import { A } from '@solidjs/router'

export const ChatGenSettingsModal: Component<{
  chat: AppSchema.Chat
  show: boolean
  close: () => void
}> = (props) => {
  let ref: any
  const user = userStore()
  const state = presetStore(({ presets }) => ({
    presets,
    options: presets.map((pre) => ({ label: pre.name, value: pre._id })),
  }))

  const presetOptions = createMemo(() =>
    getPresetOptions(state.presets, { builtin: true, base: true })
  )

  const presets = createMemo(() => {
    const all: Partial<AppSchema.UserGenPreset>[] = state.presets
    const defaults = Object.entries(defaultPresets).map<Partial<AppSchema.UserGenPreset>>(
      ([key, preset]) => ({ ...preset, _id: key, name: `Default - ${preset.name}` })
    )

    return all.concat(defaults)
  })

  const [selected, setSelected] = createSignal<string | undefined>(
    props.chat?.genPreset
      ? props.chat.genPreset
      : props.chat.genSettings
      ? AutoPreset.chat
      : AutoPreset.service
  )
  const [genAdapter, setAdapter] = createSignal<AIAdapter>()

  const servicePreset = createMemo(() => {
    if (!user.user) return

    const current = selected()
    if (isDefaultPreset(current)) {
      const preset = defaultPresets[current]
      return { name: preset.name, preset, fallback: true }
    }

    const adapter = genAdapter() || getAdapter(props.chat, user.user).adapter

    if (!user.user.defaultPresets) {
      const preset = getFallbackPreset(adapter)
      const name = 'name' in preset ? `${preset.name} - Fallback Preset` : 'Fallback Preset'
      return { name, preset, fallback: true }
    }

    const presetId = user.user.defaultPresets[adapter]
    const preset = isDefaultPreset(presetId)
      ? defaultPresets[presetId]
      : state.presets.find((pre) => pre._id === presetId)

    if (!preset) return
    const fallback = isDefaultPreset(presetId)
    const name =
      'name' in preset
        ? `${preset.name} - ${fallback ? 'Fallback' : 'Service'} Preset`
        : 'Fallback Preset'
    return { name, preset, fallback: isDefaultPreset(presetId) }
  })

  const onSave = () => {
    const { preset } = getStrictForm(ref, { preset: 'string' })
    if (preset === AutoPreset.chat) {
      const body = getStrictForm(ref, { ...chatGenSettings, order: 'string?' })
      const { order, ...rest } = body
      const result: AppSchema.Chat['genSettings'] = rest
      try {
        result.order = parseGenSettingsOrder(order)
      } catch (e: any) {
        toastStore.error(`Invalid order: ${e.message}`)
        return
      }
      chatStore.editChatGenSettings(props.chat._id, result, props.close)
    } else if (preset === AutoPreset.service) {
      chatStore.editChat(props.chat._id, { genPreset: preset, genSettings: undefined })
    } else {
      chatStore.editChatGenPreset(props.chat._id, preset, () => {
        props.close()
        if (isDefaultPreset(preset)) {
          toastStore.success('Preset changed')
        }
      })

      if (!isDefaultPreset(preset)) {
        const validator = {
          ...chatGenSettings,
          service: ['', ...AI_ADAPTERS],
          order: 'string?',
        } as const
        const body = getStrictForm(ref, validator)
        const { order, service, ...rest } = body
        if (!service) {
          toastStore.error(`You must select an AI service before saving`)
          return
        }
        const result: AppSchema.Chat['genSettings'] = { ...rest, service }
        try {
          result.order = parseGenSettingsOrder(order)
        } catch (e: any) {
          toastStore.error(`Invalid order: ${e.message}`)
          return
        }
        presetStore.updatePreset(preset, result)
      }
    }
  }

  const Footer = (
    <>
      <Button schema="secondary" onClick={props.close}>
        <X /> Cancel
      </Button>

      <Button onClick={onSave}>
        <Save /> Save
      </Button>
    </>
  )

  return (
    <Modal
      show={props.show}
      close={props.close}
      footer={Footer}
      title="Generation Settings"
      fixedHeight
      maxWidth="half"
    >
      <div class="text-sm">
        <form ref={ref} class="flex flex-col gap-2">
          <Select
            fieldName="preset"
            items={presetOptions()}
            value={selected()}
            onChange={(item) => setSelected(item.value)}
          />

          <Show when={isDefaultPreset(selected())}>
            <span class="text-[var(--hl-100)]">
              You are using a built-in preset which cannot be modified. Head to the{' '}
              <A href="/presets" class="link">
                Presets
              </A>{' '}
              page to create a preset or{' '}
              <A href={`/presets/new?preset=${selected()}`} class="link">
                Duplicate
              </A>{' '}
              this one.
            </span>
          </Show>

          <Switch>
            <Match when={selected() === AutoPreset.service && servicePreset()}>
              <div class="bold text-md">Using: {servicePreset()!.name}</div>
              <GenerationSettings
                inherit={servicePreset()!.preset}
                disabled={servicePreset()?.fallback}
                onService={setAdapter}
                disableService
              />
            </Match>

            <Match when={selected() === AutoPreset.chat}>
              <div class="bold text-md">Using: Chat Settings</div>
              <GenerationSettings inherit={props.chat.genSettings} onService={setAdapter} />
            </Match>

            <Match when={true}>
              <For each={presets()}>
                {(preset) => (
                  <Show when={selected() === preset._id!}>
                    <div class="bold text-md">Using: {preset.name} (User Preset)</div>
                    <GenerationSettings
                      inherit={preset}
                      disabled={isDefaultPreset(selected())}
                      onService={setAdapter}
                    />
                  </Show>
                )}
              </For>
            </Match>
          </Switch>
        </form>
      </div>
    </Modal>
  )
}
