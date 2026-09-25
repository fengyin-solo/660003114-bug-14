import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NFA, MatchGroup, MatchResult, MatchStep, RegexTemplate, ASTNode } from '../types'

const GROUP_COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4']
const FULL_MATCH_COLOR = '#22c55e'

export const TEMPLATES: RegexTemplate[] = [
  { name: '邮箱地址', pattern: '^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$', description: '匹配标准邮箱格式：用户名@域名.顶级域', testString: 'user@example.com admin@mail.org test.user+tag@sub.domain.co.uk', category: '常用' },
  { name: 'URL链接', pattern: '^(https?)://([^/:]+)(?::(\\d+))?(.*)$', description: '匹配HTTP/HTTPS URL：协议://主机:端口/路径', testString: 'https://www.example.com:8080/path/to/page http://localhost:3000/api', category: '常用' },
  { name: 'IPv4地址', pattern: '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$', description: '匹配IPv4地址四段数字', testString: '192.168.1.1 10.0.0.1 255.255.255.0', category: '常用' },
  { name: '日期格式', pattern: '^(\\d{4})-(\\d{2})-(\\d{2})$', description: '匹配YYYY-MM-DD日期', testString: '2024-01-15 1999-12-31 2025-06-06', category: '常用' },
  { name: '手机号码', pattern: '^1[3-9]\\d{9}$', description: '匹配中国大陆手机号', testString: '13800138000 15912345678 18600000000', category: '常用' },
  { name: '身份证号', pattern: '^(\\d{6})(\\d{4})(\\d{2})(\\d{2})(\\d{3})([0-9Xx])$', description: '18位身份证：地区码+出生日期+顺序码+校验码', testString: '11010119900101001X 440304200512120039', category: '常用' },
  { name: '十六进制颜色', pattern: '^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$', description: '匹配#RGB或#RRGGBB格式', testString: '#FF5733 #abc #1A2B3C ff0000', category: '前端' },
  { name: '邮政编码', pattern: '^\\d{6}$', description: '6位中国邮编', testString: '100000 518000 200120', category: '常用' },
  { name: '浮点数', pattern: '^-?\\d+\\.\\d+$', description: '匹配带小数点的数字', testString: '3.14 -0.5 100.0', category: '数字' },
  { name: '科学计数法', pattern: '^-?\\d+(\\.\\d+)?[eE][+-]?\\d+$', description: '匹配科学计数法数字', testString: '1.5e10 -2.3E-4 6.022e23', category: '数字' },
  { name: 'MAC地址', pattern: '^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$', description: '匹配MAC地址XX:XX:XX:XX:XX:XX', testString: '00:1A:2B:3C:4D:5E AA-BB-CC-DD-EE-FF', category: '网络' },
  { name: 'UUID', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', description: '标准UUID格式', testString: '550e8400-e29b-41d4-a716-446655440000', category: '网络' },
  { name: 'QQ号', pattern: '^[1-9]\\d{4,10}$', description: '5-11位QQ号', testString: '12345 10000 1234567890', category: '常用' },
  { name: '密码强度', pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$', description: '至少8位含大小写字母数字特殊字符', testString: 'Passw0rd! Str0ng@Pass', category: '安全' },
  { name: '中文姓名', pattern: '^[\\u4e00-\\u9fa5]{2,4}$', description: '2-4位中文字符', testString: '张三 李世明 王小明', category: '常用' },
  { name: '车牌号', pattern: '^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-HJ-NP-Z0-9]{5}$', description: '中国车牌格式', testString: '京A12345 沪B6789X', category: '常用' },
  { name: 'HTML标签', pattern: '<(\\w+)(\\s[^>]*)?>(.*?)</\\1>', description: '匹配HTML开闭标签对', testString: '<div class="x">content</div> <span>text</span>', category: '前端' },
  { name: '文件扩展名', pattern: '^.+\\.(\\w+)$', description: '提取文件扩展名', testString: 'image.png doc.pdf index.html', category: '前端' },
  { name: '经纬度', pattern: '^(\\-?\\d{1,3}\\.\\d+)\\s*,\\s*(\\-?\\d{1,3}\\.\\d+)$', description: '匹配经纬度坐标', testString: '116.404,39.915 -73.9857,40.7484', category: '地理' },
  { name: '版本号', pattern: '^(\\d+)\\.(\\d+)\\.(\\d+)(?:-(\\w+))?$', description: '语义化版本号x.y.z-tag', testString: '1.0.0 2.3.1-beta 10.20.30', category: '常用' },
  { name: '时间格式', pattern: '^([01]?\\d|2[0-3]):([0-5]\\d)(?::([0-5]\\d))?$', description: 'HH:MM或HH:MM:SS', testString: '14:30 23:59:59 00:00', category: '常用' }
]

interface Fragment {
  start: number
  end: number
}

interface MatcherInfo {
  label: string
  test: (ch: string) => boolean
}

interface AssertionInfo {
  to: number
  test: (input: string, index: number) => boolean
}

interface StateNode {
  id: number
  isAccept: boolean
  transitions: Map<string, number[]>
  epsilonTransitions: number[]
  matchers: Map<string, MatcherInfo>
  assertions: AssertionInfo[]
}

interface CapturingGroupMeta {
  index: number
  name?: string
}

function buildNFA(pattern: string): { states: StateNode[]; startState: number; acceptStates: number[] } {
  const states: StateNode[] = []
  let stateCounter = 0
  let matcherCounter = 0
  let pos = 0

  function newState(): number {
    const id = stateCounter++
    states.push({
      id,
      isAccept: false,
      transitions: new Map(),
      epsilonTransitions: [],
      matchers: new Map(),
      assertions: []
    })
    return id
  }

  function addTransition(from: number, symbol: string, to: number) {
    const targets = states[from].transitions.get(symbol)
    if (targets) targets.push(to)
    else states[from].transitions.set(symbol, [to])
  }

  function addEpsilon(from: number, to: number) {
    states[from].epsilonTransitions.push(to)
  }

  function addMatcher(from: number, to: number, label: string, test: MatcherInfo['test']) {
    const symbol = `__matcher_${matcherCounter++}`
    addTransition(from, symbol, to)
    states[from].matchers.set(symbol, { label, test })
  }

  function addAssertion(from: number, to: number, test: AssertionInfo['test']) {
    states[from].assertions.push({ to, test })
  }

  function epsilonFragment(): Fragment {
    const start = newState()
    const end = newState()
    addEpsilon(start, end)
    return { start, end }
  }

  function literalFragment(ch: string): Fragment {
    const start = newState()
    const end = newState()
    addTransition(start, ch, end)
    return { start, end }
  }

  function isWordChar(ch: string | undefined): boolean {
    return !!ch && /\w/.test(ch)
  }

  function anchorFragment(anchor: '^' | '$' | 'b' | 'B'): Fragment {
    const start = newState()
    const end = newState()
    addAssertion(start, end, (input, index) => {
      if (anchor === '^') return index === 0
      if (anchor === '$') return index === input.length
      const before = isWordChar(input[index - 1])
      const after = isWordChar(input[index])
      return anchor === 'b' ? before !== after : before === after
    })
    return { start, end }
  }

  function classTokenMatches(token: { code?: string; value?: string }, ch: string): boolean {
    if (token.code === 'd') return /\d/.test(ch)
    if (token.code === 'D') return !/\d/.test(ch)
    if (token.code === 'w') return /\w/.test(ch)
    if (token.code === 'W') return !/\w/.test(ch)
    if (token.code === 's') return /\s/.test(ch)
    if (token.code === 'S') return !/\s/.test(ch)
    return token.value === ch
  }

  function readClassToken(): { code?: string; value?: string } {
    if (pattern[pos] !== '\\') {
      const value = pattern[pos]
      pos++
      return { value }
    }

    pos++
    const escaped = pattern[pos]
    pos++
    if ('dDwWsS'.includes(escaped)) return { code: escaped }
    if (escaped === 'b') return { value: '\b' }
    if (escaped === 'n') return { value: '\n' }
    if (escaped === 'r') return { value: '\r' }
    if (escaped === 't') return { value: '\t' }
    if (escaped === 'f') return { value: '\f' }
    if (escaped === 'v') return { value: '\v' }
    if (escaped === '0') return { value: '\0' }
    return { value: escaped || '' }
  }

  function parseCharClass(): Fragment {
    const classStart = pos - 1
    const negative = pattern[pos] === '^'
    if (negative) pos++

    const tests: Array<(ch: string) => boolean> = []
    let hasToken = false

    while (pos < pattern.length) {
      if (pattern[pos] === ']' && hasToken) break
      const first = readClassToken()
      hasToken = true

      if (pattern[pos] === '-' && first.value !== '-' && pattern[pos + 1] && pattern[pos + 1] !== ']' && first.value !== undefined) {
        pos++
        const second = readClassToken()
        if (second.value === undefined) {
          tests.push(ch => classTokenMatches(first, ch) || ch === '-')
          tests.push(ch => classTokenMatches(second, ch))
        } else {
          const startCode = first.value.charCodeAt(0)
          const endCode = second.value.charCodeAt(0)
          if (endCode < startCode) throw new Error('字符类范围顺序错误')
          tests.push(ch => {
            const code = ch.charCodeAt(0)
            return code >= startCode && code <= endCode
          })
        }
      } else if (pattern[pos] === '-') {
        tests.push(ch => ch === '-')
        pos++
      } else {
        tests.push(ch => classTokenMatches(first, ch))
      }
    }

    if (pattern[pos] !== ']') throw new Error('字符类缺少结束符号 ]')
    pos++
    const label = pattern.slice(classStart, pos)
    const start = newState()
    const end = newState()
    addMatcher(start, end, label, ch => {
      const matched = tests.some(test => test(ch))
      return negative ? !matched : matched
    })
    return { start, end }
  }

  function skipBalancedGroup(): void {
    let depth = 1
    while (pos < pattern.length && depth > 0) {
      const ch = pattern[pos]
      if (ch === '\\') pos += 2
      else if (ch === '[') {
        pos++
        if (pattern[pos] === '^') pos++
        if (pattern[pos] === ']') pos++
        while (pos < pattern.length && pattern[pos] !== ']') {
          if (pattern[pos] === '\\') pos++
          pos++
        }
        if (pattern[pos] !== ']') throw new Error('字符类缺少结束符号 ]')
        pos++
      } else if (ch === '(') {
        depth++
        pos++
      } else if (ch === ')') {
        depth--
        pos++
      } else {
        pos++
      }
    }
    if (depth !== 0) throw new Error('分组缺少结束符号 )')
  }

  function readHex(count: number): string {
    const hex = pattern.slice(pos, pos + count)
    if (!new RegExp(`^[0-9a-fA-F]{${count}}$`).test(hex)) throw new Error('无效的 Unicode 转义')
    pos += count
    return String.fromCodePoint(parseInt(hex, 16))
  }

  function parseAtom(): Fragment {
    const ch = pattern[pos]

    if (ch === '(') {
      pos++
      if (pattern[pos] === '?') {
        pos++
        const kind = pattern[pos]

        if (kind === '=' || kind === '!') {
          pos++
          skipBalancedGroup()
          return epsilonFragment()
        }

        if (kind === '<') {
          pos++
          if (pattern[pos] === '=' || pattern[pos] === '!') {
            pos++
            skipBalancedGroup()
            return epsilonFragment()
          }

          const nameStart = pos
          while (pos < pattern.length && pattern[pos] !== '>') pos++
          if (pattern[pos] !== '>') throw new Error('命名分组缺少 >')
          const name = pattern.slice(nameStart, pos)
          if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error('无效的分组名称')
          pos++
          const fragment = parseOr()
          if (pattern[pos] !== ')') throw new Error('分组缺少结束符号 )')
          pos++
          return fragment
        }

        if (kind === ':' || kind === '>') {
          pos++
          const fragment = parseOr()
          if (pattern[pos] !== ')') throw new Error('分组缺少结束符号 )')
          pos++
          return fragment
        }

        while (pos < pattern.length && pattern[pos] !== ':' && pattern[pos] !== ')') pos++
        if (pattern[pos] === ':') pos++
        else if (pattern[pos] === ')') {
          pos++
          return epsilonFragment()
        } else {
          throw new Error('无效的分组语法')
        }
      }

      const fragment = parseOr()
      if (pattern[pos] !== ')') throw new Error('分组缺少结束符号 )')
      pos++
      return fragment
    }

    if (ch === '[') {
      pos++
      return parseCharClass()
    }

    if (ch === '.') {
      pos++
      const start = newState()
      const end = newState()
      addMatcher(start, end, '.', character => character !== '\n')
      return { start, end }
    }

    if (ch === '^' || ch === '$') {
      pos++
      return anchorFragment(ch)
    }

    if (ch === '\\') {
      pos++
      const escaped = pattern[pos]
      if (escaped === undefined) throw new Error('无效的转义字符')
      pos++

      if (escaped === 'd' || escaped === 'D' || escaped === 'w' || escaped === 'W' || escaped === 's' || escaped === 'S') {
        const start = newState()
        const end = newState()
        const label = `\\${escaped}`
        addMatcher(start, end, label, character => {
          if (escaped === 'd') return /\d/.test(character)
          if (escaped === 'D') return !/\d/.test(character)
          if (escaped === 'w') return /\w/.test(character)
          if (escaped === 'W') return !/\w/.test(character)
          if (escaped === 's') return /\s/.test(character)
          return !/\s/.test(character)
        })
        return { start, end }
      }

      if (escaped === 'b' || escaped === 'B') return anchorFragment(escaped)
      if (escaped === 'k' && pattern[pos] === '<') {
        const nameEnd = pattern.indexOf('>', pos + 1)
        if (nameEnd === -1) throw new Error('命名反向引用缺少 >')
        pos = nameEnd + 1
        return epsilonFragment()
      }
      if (escaped >= '1' && escaped <= '9') return epsilonFragment()

      let value = escaped
      if (escaped === 'n') value = '\n'
      else if (escaped === 'r') value = '\r'
      else if (escaped === 't') value = '\t'
      else if (escaped === 'f') value = '\f'
      else if (escaped === 'v') value = '\v'
      else if (escaped === '0') value = '\0'
      else if (escaped === 'x') value = readHex(2)
      else if (escaped === 'u') {
        if (pattern[pos] === '{') {
          pos++
          const end = pattern.indexOf('}', pos)
          if (end === -1) throw new Error('无效的 Unicode 转义')
          const hex = pattern.slice(pos, end)
          if (!/^[0-9a-fA-F]+$/.test(hex)) throw new Error('无效的 Unicode 转义')
          value = String.fromCodePoint(parseInt(hex, 16))
          pos = end + 1
        } else {
          value = readHex(4)
        }
      }

      return literalFragment(value)
    }

    if (ch === undefined) throw new Error('意外的正则结尾')
    pos++
    return literalFragment(ch)
  }

  function cloneFragment(fragment: Fragment): Fragment {
    const mapping = new Map<number, number>()
    for (let oldId = fragment.start; oldId <= fragment.end; oldId++) {
      const oldState = states[oldId]
      const newId = newState()
      mapping.set(oldId, newId)
      states[newId].isAccept = oldState.isAccept
      oldState.matchers.forEach((matcher, symbol) => states[newId].matchers.set(symbol, matcher))
    }

    // Remap targets after every state in the fragment has been cloned.
    for (let oldId = fragment.start; oldId <= fragment.end; oldId++) {
      const oldState = states[oldId]
      const newId = mapping.get(oldId)!
      const newState = states[newId]
      newState.transitions.clear()
      oldState.transitions.forEach((targets, symbol) => {
        newState.transitions.set(symbol, targets.map(target => mapping.get(target) ?? target))
      })
      newState.epsilonTransitions = oldState.epsilonTransitions.map(target => mapping.get(target) ?? target)
      newState.assertions = oldState.assertions.map(assertion => ({
        to: mapping.get(assertion.to) ?? assertion.to,
        test: assertion.test
      }))
    }

    return { start: mapping.get(fragment.start)!, end: mapping.get(fragment.end)! }
  }

  function appendFragment(target: Fragment, part: Fragment): Fragment {
    addEpsilon(target.end, part.start)
    return { start: target.start, end: part.end }
  }

  function applySimpleQuantifier(fragment: Fragment, quantifier: '*' | '+' | '?'): Fragment {
    const start = newState()
    const end = newState()
    addEpsilon(start, fragment.start)
    if (quantifier === '*') {
      addEpsilon(start, end)
      addEpsilon(fragment.end, end)
      addEpsilon(fragment.end, fragment.start)
    } else if (quantifier === '+') {
      addEpsilon(fragment.end, end)
      addEpsilon(fragment.end, fragment.start)
    } else {
      addEpsilon(start, end)
      addEpsilon(fragment.end, end)
    }
    return { start, end }
  }

  function repeatFragment(fragment: Fragment, min: number, max: number): Fragment {
    let result = epsilonFragment()
    for (let i = 0; i < min; i++) {
      result = appendFragment(result, cloneFragment(fragment))
    }

    if (!Number.isFinite(max)) {
      result = appendFragment(result, applySimpleQuantifier(cloneFragment(fragment), '*'))
    } else {
      const optionalCount = max - min
      for (let i = 0; i < optionalCount; i++) {
        result = appendFragment(result, applySimpleQuantifier(cloneFragment(fragment), '?'))
      }
    }
    return result
  }

  function applyQuantifiers(fragment: Fragment): Fragment {
    let result = fragment
    while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
      if (pattern[pos] === '{') {
        const matched = /^\{(\d+)(?:,(\d*))?\}/.exec(pattern.slice(pos))
        if (!matched) break
        const min = Number(matched[1])
        const max = matched[2] === undefined ? min : matched[2] === '' ? Number.POSITIVE_INFINITY : Number(matched[2])
        if (Number.isFinite(max) && max < min) throw new Error('量词范围无效')
        pos += matched[0].length
        result = repeatFragment(result, min, max)
      } else {
        const quantifier = pattern[pos] as '*' | '+' | '?'
        pos++
        result = applySimpleQuantifier(result, quantifier)
      }
      if (pattern[pos] === '?') pos++
    }
    return result
  }

  function parseConcat(): Fragment {
    let result: Fragment | null = null
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      const atom = applyQuantifiers(parseAtom())
      result = result ? appendFragment(result, atom) : atom
    }
    return result ?? epsilonFragment()
  }

  function parseOr(): Fragment {
    let left = parseConcat()
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const right = parseConcat()
      const start = newState()
      const end = newState()
      addEpsilon(start, left.start)
      addEpsilon(start, right.start)
      addEpsilon(left.end, end)
      addEpsilon(right.end, end)
      left = { start, end }
    }
    return left
  }

  const startState = newState()
  const body = parseOr()
  if (pos !== pattern.length) throw new Error('正则表达式解析失败')
  addEpsilon(startState, body.start)
  const acceptState = body.end
  states[acceptState].isAccept = true
  return { states, startState, acceptStates: [acceptState] }
}

function epsilonClosure(states: StateNode[], stateId: number, input = '', index = 0): Set<number> {
  const closure = new Set<number>([stateId])
  const stack = [stateId]
  while (stack.length) {
    const stateId = stack.pop()!
    const state = states[stateId]
    for (const next of state.epsilonTransitions) {
      if (!closure.has(next)) {
        closure.add(next)
        stack.push(next)
      }
    }
    for (const assertion of state.assertions) {
      if (assertion.test(input, index) && !closure.has(assertion.to)) {
        closure.add(assertion.to)
        stack.push(assertion.to)
      }
    }
  }
  return closure
}

function matchTransition(state: StateNode, symbol: string): number[] {
  const results: number[] = []
  for (const [transitionSymbol, targets] of state.transitions) {
    if (transitionSymbol === symbol) {
      results.push(...targets)
      continue
    }
    if (transitionSymbol.startsWith('__matcher_')) {
      const matcher = state.matchers.get(transitionSymbol)
      if (matcher?.test(symbol)) results.push(...targets)
    }
  }
  return results
}

function runMatch(states: StateNode[], startState: number, input: string) {
  const steps: MatchStep[] = []
  let backtracks = 0
  let stepIndex = 0
  const startTime = performance.now()

  for (let startPos = 0; startPos <= input.length; startPos++) {
    let currentStates = Array.from(epsilonClosure(states, startState, input, startPos))
    const acceptsBeforeConsuming = currentStates.some(state => states[state].isAccept)
    let matched = false
    let matchEnd = startPos
    let consumed = false

    for (let i = startPos; i < input.length; i++) {
      const char = input[i]
      const nextStates: number[] = []
      const seen = new Set<number>()

      for (const stateId of currentStates) {
        const targets = matchTransition(states[stateId], char)
        for (const target of targets) {
          const closure = epsilonClosure(states, target, input, i + 1)
          for (const nextState of closure) {
            if (!seen.has(nextState)) {
              seen.add(nextState)
              nextStates.push(nextState)
              steps.push({
                stepIndex: stepIndex++,
                charIndex: i,
                char,
                currentState: stateId,
                nextState,
                transition: char,
                isBacktrack: false,
                isMatch: true
              })
            }
          }
        }
      }

      if (nextStates.length === 0) {
        if (currentStates.some(state => states[state].isAccept)) {
          matched = true
          matchEnd = i
          break
        }
        backtracks++
        steps.push({
          stepIndex: stepIndex++,
          charIndex: i,
          char,
          currentState: currentStates[0] ?? -1,
          nextState: -1,
          transition: 'FAIL',
          isBacktrack: true,
          isMatch: false
        })
        break
      }

      consumed = true
      currentStates = nextStates
      if (currentStates.some(state => states[state].isAccept)) {
        matched = true
        matchEnd = i + 1
      }
    }

    const acceptsAtEnd = currentStates.some(state => states[state].isAccept)
    if (acceptsAtEnd && (consumed || acceptsBeforeConsuming)) {
      matched = true
    }

    if (matched) {
      return {
        start: startPos,
        end: matchEnd,
        steps,
        backtracks,
        totalSteps: stepIndex,
        duration: performance.now() - startTime
      }
    }
  }

  return {
    start: -1,
    end: -1,
    steps,
    backtracks,
    totalSteps: stepIndex,
    duration: performance.now() - startTime
  }
}

export function computeNFA(nfaResult: ReturnType<typeof buildNFA>): NFA {
  const nodes = nfaResult.states.map((state, index) => ({
    id: state.id,
    isStart: index === nfaResult.startState,
    isAccept: nfaResult.acceptStates.includes(state.id),
    x: 0,
    y: 0
  }))

  const cx = 400
  const cy = 300
  const radius = Math.max(180, nodes.length * 7)
  nodes.forEach((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2
    node.x = cx + Math.cos(angle) * radius
    node.y = cy + Math.sin(angle) * radius
  })

  const transitions: NFA['transitions'] = []
  const seen = new Set<string>()
  nfaResult.states.forEach(state => {
    state.transitions.forEach((targets, symbol) => {
      targets.forEach(to => {
        const matcher = state.matchers.get(symbol)
        const label = matcher?.label ?? symbol
        const key = `${state.id}-${to}-${label}`
        if (!seen.has(key)) {
          seen.add(key)
          transitions.push({ from: state.id, to, symbol, label })
        }
      })
    })
    state.epsilonTransitions.forEach(to => {
      const key = `${state.id}-${to}-ε`
      if (!seen.has(key)) {
        seen.add(key)
        transitions.push({ from: state.id, to, symbol: null, label: 'ε' })
      }
    })
  })

  return { states: nodes, transitions, startState: nfaResult.startState, acceptStates: nfaResult.acceptStates }
}

function parseAST(pattern: string): ASTNode {
  let pos = 0
  let groupIdx = 0

  function parseAtom(): ASTNode {
    const ch = pattern[pos]
    if (ch === '(') {
      pos++
      let capturing = true
      if (pattern[pos] === '?') {
        pos++
        if (pattern[pos] === ':') {
          pos++
          capturing = false
        } else if (pattern[pos] === '<') {
          pos++
          if (pattern[pos] !== '=' && pattern[pos] !== '!') {
            while (pos < pattern.length && pattern[pos] !== '>') pos++
            pos++
          } else {
            capturing = false
          }
        } else if (pattern[pos] === '=' || pattern[pos] === '!') {
          capturing = false
        } else {
          while (pos < pattern.length && pattern[pos] !== ':' && pattern[pos] !== ')') pos++
          if (pattern[pos] === ':') pos++
          else capturing = false
        }
      }
      if (capturing) groupIdx++
      const currentGroup = groupIdx
      const node = parseOr()
      if (pattern[pos] === ')') pos++
      return { type: 'group', children: [node], groupIndex: capturing ? currentGroup : undefined }
    }
    if (ch === '[') {
      pos++
      let cls = ''
      if (pattern[pos] === '^') {
        cls += '^'
        pos++
      }
      while (pos < pattern.length && pattern[pos] !== ']') {
        cls += pattern[pos]
        if (pattern[pos] === '\\') pos++
        pos++
      }
      pos++
      return { type: 'charclass', value: cls }
    }
    if (ch === '.') { pos++; return { type: 'dot' } }
    if (ch === '\\') {
      pos++
      const e = pattern[pos]; pos++
      if (e === 'd') return { type: 'digit' }
      if (e === 'w') return { type: 'word' }
      if (e === 's') return { type: 'space' }
      return { type: 'char', value: e }
    }
    if (ch === '^' || ch === '$') { pos++; return { type: 'anchor', value: ch } }
    pos++
    return { type: 'char', value: ch }
  }

  function parseQuantifier(): ASTNode {
    let node = parseAtom()
    while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
      const q = pattern[pos]
      if (q === '{') {
        const matched = /^\{(\d+)(?:,(\d*))?\}/.exec(pattern.slice(pos))
        if (!matched) {
          node = { type: 'concat', children: [node, { type: 'char', value: '{' }] }
          pos++
          continue
        }
        pos += matched[0].length
        node = { type: matched[1] === '0' ? 'question' : 'plus', children: [node] }
      } else {
        pos++
        const type = q === '*' ? 'star' : q === '+' ? 'plus' : 'question'
        node = { type, children: [node] }
      }
      if (pattern[pos] === '?') pos++
    }
    return node
  }

  function parseConcat(): ASTNode {
    const nodes: ASTNode[] = []
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      nodes.push(parseQuantifier())
    }
    if (nodes.length === 1) return nodes[0]
    return { type: 'concat', children: nodes }
  }

  function parseOr(): ASTNode {
    let left = parseConcat()
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const right = parseConcat()
      left = { type: 'or', children: [left, right] }
    }
    return left
  }

  return parseOr()
}

function scanCapturingGroups(pattern: string): CapturingGroupMeta[] {
  const groups: CapturingGroupMeta[] = []
  let index = 0
  let pos = 0

  function skipCharClass() {
    pos++
    if (pattern[pos] === '^') pos++
    if (pattern[pos] === ']') pos++
    while (pos < pattern.length && pattern[pos] !== ']') {
      if (pattern[pos] === '\\') pos++
      pos++
    }
    if (pattern[pos] !== ']') throw new Error('字符类缺少结束符号 ]')
    pos++
  }

  while (pos < pattern.length) {
    const ch = pattern[pos]
    if (ch === '\\') pos += 2
    else if (ch === '[') skipCharClass()
    else if (ch === '(') {
      pos++
      let capturing = false
      let name: string | undefined

      if (pattern[pos] === '?') {
        pos++
        if (pattern[pos] === ':' || pattern[pos] === '>' || pattern[pos] === '=' || pattern[pos] === '!') {
          pos++
        } else if (pattern[pos] === '<') {
          pos++
          if (pattern[pos] === '=' || pattern[pos] === '!') {
            pos++
          } else {
            capturing = true
            const nameStart = pos
            while (pos < pattern.length && pattern[pos] !== '>') pos++
            if (pattern[pos] !== '>') throw new Error('命名分组缺少 >')
            name = pattern.slice(nameStart, pos)
            pos++
          }
        } else {
          while (pos < pattern.length && pattern[pos] !== ':' && pattern[pos] !== ')') pos++
          if (pattern[pos] === ':') pos++
          else if (pattern[pos] === ')') pos++
        }
      } else {
        capturing = true
      }

      if (capturing) groups.push({ index: ++index, name })
    } else {
      pos++
    }
  }

  return groups
}

function makeGroups(metas: CapturingGroupMeta[], match: RegExpExecArray | null): MatchGroup[] {
  const groups: MatchGroup[] = [{
    index: 0,
    content: match?.[0] ?? '',
    status: !match ? 'unmatched' : match[0] === '' ? 'empty' : 'matched'
  }]

  metas.forEach(meta => {
    if (!match) {
      groups.push({ ...meta, content: '', status: 'unmatched' })
      return
    }
    const value = match[meta.index]
    groups.push({
      ...meta,
      content: value ?? '',
      status: value === undefined ? 'unmatched' : value === '' ? 'empty' : 'matched'
    })
  })
  return groups
}

export const useRegexStore = defineStore('regex', () => {
  const pattern = ref('^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$')
  const testString = ref('user@example.com admin@mail.org invalid-email')
  const currentStep = ref(0)
  const isPlaying = ref(false)
  const nfa = ref<NFA | null>(null)
  const matchResult = ref<MatchResult | null>(null)
  const ast = ref<ASTNode | null>(null)
  const error = ref('')
  const selectedTemplate = ref<string>('')
  let playTimer: ReturnType<typeof setInterval> | null = null
  let inputTimer: ReturnType<typeof setTimeout> | null = null

  const groupColors = GROUP_COLORS

  function getGroupColor(index: number): string {
    return index === 0 ? FULL_MATCH_COLOR : GROUP_COLORS[(index - 1) % GROUP_COLORS.length]
  }

  const matchHighlight = computed(() => {
    const result = matchResult.value
    if (!result?.matched || result.matchIndex < 0) return null
    return {
      before: testString.value.substring(0, result.matchIndex),
      match: result.matchText,
      after: testString.value.substring(result.matchIndex + result.matchText.length)
    }
  })

  function clearPlayTimer() {
    if (playTimer !== null) {
      clearInterval(playTimer)
      playTimer = null
    }
    isPlaying.value = false
  }

  function execute() {
    clearPlayTimer()
    if (inputTimer !== null) {
      clearTimeout(inputTimer)
      inputTimer = null
    }
    const startTime = performance.now()
    error.value = ''

    let regex: RegExp
    try {
      regex = new RegExp(pattern.value)
    } catch (e) {
      nfa.value = null
      matchResult.value = null
      ast.value = null
      currentStep.value = 0
      error.value = e instanceof Error ? e.message : '正则表达式语法错误'
      return
    }

    let nativeMatch: RegExpExecArray | null = null
    try {
      nativeMatch = regex.exec(testString.value)
    } catch (e) {
      nfa.value = null
      matchResult.value = null
      ast.value = null
      currentStep.value = 0
      error.value = e instanceof Error ? e.message : '正则执行失败'
      return
    }

    const metas = scanCapturingGroups(pattern.value)
    let simulation = { steps: [] as MatchStep[], backtracks: 0, totalSteps: 0 }

    try {
      const built = buildNFA(pattern.value)
      nfa.value = computeNFA(built)
      simulation = runMatch(built.states, built.startState, testString.value)
    } catch {
      nfa.value = null
    }

    try {
      ast.value = parseAST(pattern.value)
    } catch {
      ast.value = null
    }

    const groups = makeGroups(metas, nativeMatch)
    matchResult.value = {
      matched: nativeMatch !== null,
      matchText: nativeMatch?.[0] ?? '',
      matchIndex: nativeMatch?.index ?? -1,
      groups,
      steps: simulation.steps,
      backtracks: simulation.backtracks,
      totalSteps: simulation.totalSteps,
      duration: Math.round((performance.now() - startTime) * 100) / 100
    }
    currentStep.value = 0
  }

  function schedulePattern(p: string) {
    if (inputTimer !== null) clearTimeout(inputTimer)
    inputTimer = setTimeout(() => setPattern(p), 300)
  }

  function scheduleTestString(s: string) {
    if (inputTimer !== null) clearTimeout(inputTimer)
    inputTimer = setTimeout(() => setTestString(s), 300)
  }

  function setPattern(p: string) {
    pattern.value = p
    selectedTemplate.value = ''
    execute()
  }

  function setTestString(s: string) {
    testString.value = s
    execute()
  }

  function setInputs(p: string, s: string) {
    if (inputTimer !== null) {
      clearTimeout(inputTimer)
      inputTimer = null
    }
    pattern.value = p
    testString.value = s
    execute()
  }

  function applyTemplate(t: RegexTemplate) {
    if (inputTimer !== null) {
      clearTimeout(inputTimer)
      inputTimer = null
    }
    pattern.value = t.pattern
    testString.value = t.testString
    selectedTemplate.value = t.name
    execute()
  }

  function stepForward() {
    if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
      currentStep.value++
    }
  }

  function stepBackward() {
    if (currentStep.value > 0) currentStep.value--
  }

  function resetStep() {
    currentStep.value = 0
  }

  function play() {
    if (!matchResult.value || matchResult.value.steps.length === 0) return
    clearPlayTimer()
    if (currentStep.value >= matchResult.value.steps.length - 1) currentStep.value = 0
    isPlaying.value = true
    playTimer = setInterval(() => {
      if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
        currentStep.value++
      } else {
        clearPlayTimer()
      }
    }, 200)
  }

  function stop() {
    clearPlayTimer()
  }

  return {
    pattern, testString, currentStep, isPlaying, nfa, matchResult, ast, error,
    selectedTemplate, groupColors, matchHighlight, getGroupColor,
    execute, setPattern, setTestString, setInputs, schedulePattern, scheduleTestString, applyTemplate,
    stepForward, stepBackward, resetStep, play, stop
  }
})
