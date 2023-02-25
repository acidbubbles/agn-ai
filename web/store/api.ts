import { toastStore } from './toasts'
import { userStore } from './user'

const baseUrl = `http://${location.hostname}:3001`

export const api = {
  get,
  post,
  method,
  upload,
  streamGet,
  streamPost,
}

type Query = { [key: string]: string | number }

async function method<T = any>(
  method: 'get' | 'post' | 'delete' | 'put',
  path: string,
  body = {},
  opts?: RequestInit
) {
  if (method === 'get') {
    return get<T>(path, body)
  }

  return callApi<T>(path, {
    method,
    ...opts,
    body: JSON.stringify(body),
  })
}

async function get<T = any>(path: string, query: Query = {}) {
  const params = Object.keys(query)
    .map((key) => `${key}=${query[key]}`)
    .join('&')

  return callApi<T>(`${path}?${params}`, {
    method: 'get',
  })
}

async function post<T = any>(path: string, body = {}) {
  return callApi<T>(path, {
    method: 'post',
    body: JSON.stringify(body),
  })
}

async function upload<T = any>(path: string, form: FormData) {
  return callApi<T>(path, {
    method: 'post',
    body: form,
    headers: undefined,
  })
}

async function streamGet<T = any>(path: string, query: Query) {
  const params = Object.keys(query)
    .map((key) => `${key}=${query[key]}`)
    .join('&')

  return callApiStream<T>(`${path}?${params}`, { method: 'get' })
}

async function streamPost<T = any>(path: string, body: any) {
  return callApiStream<T>(path, {
    method: 'post',
    body: JSON.stringify(body),
  })
}

async function callApi<T = any>(
  path: string,
  opts: RequestInit
): Promise<{ result: T | undefined; status: number; error?: string }> {
  const prefix = path.startsWith('/') ? '/api' : '/api'
  const res = await fetch(`${baseUrl}${prefix}${path}`, {
    ...headers(),
    ...opts,
  })

  const json = await res.json()

  if (res.status === 401) {
    return { result: undefined, status: 401, error: 'Unauthorized' }
  }

  if (res.status >= 400) {
    return { result: undefined, status: res.status, error: json.message || res.statusText }
  }

  return { result: json, status: res.status, error: res.status >= 400 ? res.statusText : undefined }
}

function headers() {
  const { jwt } = userStore.getState()
  const headers: any = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`
  }

  return { headers }
}

function toastError(err: any) {
  if (!err) {
    toastStore.error(`Unexpected error occurred`)
    throw err
  }

  if (err.message) {
    toastStore.error(err.message)
    throw err
  }

  toastStore.error(err)
  throw err
}

async function* callApiStream<T = any>(path: string, opts: RequestInit) {
  const prefix = path.startsWith('/') ? '/api' : '/api'
  const stream = await fetch(`${baseUrl}${prefix}${path}`, {
    ...opts,
    ...headers(),
  }).then((res) => res.body)

  if (!stream) {
    return
  }

  const reader = stream.getReader()
  let done = false
  do {
    const result = await reader.read()
    let done = result.done
    if (done) return
    if (!result.value) {
      yield
      continue
    }

    const buffer = Buffer.from(result.value)
    const str = buffer.toString()
    const responses = str.split('\n\n')
    for (const value of responses) {
      try {
        const json = JSON.parse(value)
        yield json
      } catch (ex) {
        yield value
      }
    }
  } while (!done)
}
