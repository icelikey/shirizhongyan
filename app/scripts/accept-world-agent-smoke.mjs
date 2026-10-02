#!/usr/bin/env node
/**
 * 终焉 Agent 接入最小验收。
 *
 * 默认只做无副作用的公开协议检查；提供 TDG_INVITE_CODE 时才会注册一个新 Agent。
 * 任何 API Key 只保存在进程内，输出中只显示 prefix 和长度。
 */

const baseUrl = (process.env.BASE_URL || process.env.TDG_BASE_URL || 'http://127.0.0.1:3010').replace(/\/$/, '')
const inviteCode = process.env.TDG_INVITE_CODE?.trim() || ''
const configuredKey = process.env.TDG_API_KEY?.trim() || ''
const configuredAgentId = process.env.TDG_AGENT_ID?.trim() || ''
const agentName = process.env.TDG_AGENT_NAME?.trim() || `smoke-${Date.now()}`

const checks = []
let apiKey = configuredKey
let agentId = configuredAgentId

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('accept', 'application/json')
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers })
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text.slice(0, 240) } }
  return { response, body }
}

function record(name, ok, detail, optional = false) {
  checks.push({ name, ok, optional, detail })
  return ok
}

function keyHint(key) {
  return key ? `${key.slice(0, 8)}… (${key.length} chars)` : null
}

async function publicChecks() {
  try {
    const { response, body } = await request('/api/health')
    record('health', response.ok && body?.ok === true, `${response.status} ${body?.service || 'unknown'}`)
  } catch (error) {
    record('health', false, error instanceof Error ? error.message : String(error))
  }

  try {
    const { response, body } = await request('/.well-known/tdg-world.json')
    record('discovery', response.ok && body?.protocolVersion === '0.1', `${response.status} protocol=${body?.protocolVersion || 'missing'}`)
  } catch (error) {
    record('discovery', false, error instanceof Error ? error.message : String(error))
  }

  try {
    const { response, body } = await request('/world/v1/games')
    const count = Array.isArray(body?.games) ? body.games.length : 0
    record('games', response.ok && count > 0, `${response.status} games=${count}`)
  } catch (error) {
    record('games', false, error instanceof Error ? error.message : String(error))
  }
}

async function registerIfRequested() {
  if (!inviteCode) {
    record('registration', true, 'skipped: TDG_INVITE_CODE 未提供', true)
    return
  }
  try {
    const { response, body } = await request('/world/v1/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: agentName, inviteCode }),
    })
    const key = body?.credential?.key
    apiKey = typeof key === 'string' ? key : ''
    agentId = body?.agent?.agentId ? String(body.agent.agentId) : agentId
    record('registration', response.status === 201 && Boolean(apiKey) && Boolean(agentId), `${response.status} agentId=${agentId || 'missing'} key=${keyHint(apiKey) || 'missing'}`)
  } catch (error) {
    record('registration', false, error instanceof Error ? error.message : String(error))
  }
}

async function privateChecks() {
  if (!apiKey || !agentId) {
    record('agent-world', true, 'skipped: 未提供可用 TDG_API_KEY + TDG_AGENT_ID', true)
    return
  }
  const headers = { 'x-api-key': apiKey }
  for (const [name, path] of [
    ['agent-world', `/world/v1/agents/${encodeURIComponent(agentId)}/world`],
    ['agent-coi', `/world/v1/agents/${encodeURIComponent(agentId)}/coi`],
    ['agent-report', `/world/v1/agents/${encodeURIComponent(agentId)}/report`],
  ]) {
    try {
      const { response, body } = await request(path, { headers })
      record(name, response.ok, `${response.status} ${body?.readOnly === true ? 'read-only' : body?.error?.code || ''}`.trim())
    } catch (error) {
      record(name, false, error instanceof Error ? error.message : String(error))
    }
  }
}

await publicChecks()
await registerIfRequested()
await privateChecks()

const failed = checks.filter((check) => !check.ok && !check.optional)
console.log(JSON.stringify({
  ok: failed.length === 0,
  baseUrl,
  agent: { agentId: agentId || null, key: keyHint(apiKey) },
  checks,
}, null, 2))

process.exitCode = failed.length === 0 ? 0 : 1
