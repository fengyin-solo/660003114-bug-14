import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NFA, MatchResult, MatchStep, RegexTemplate, ASTNode, GroupCapture, HighlightRun } from '../types'

const GROUP_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']
const WHOLE_MATCH_COLOR = '#16a34a'
const MAX_REPEAT = 100

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

interface StateNode {
  id: number
  isAccept: boolean
  transitions: Map<string, number[]>
  epsilonTransitions: number[]
  groupMarker?: { index: number; type: 'open' | 'close' }
  classMatcher?: (ch: string) => boolean
}

interface CaptureSpan {
  start?: number
  end?: number
}

interface Thread {
  state: number
  caps: Map<number, CaptureSpan>
}

function buildNFA(pattern: string): { states: StateNode[]; startState: number; acceptStates: number[]; groupCount: number; groupNames: (string | null)[] } {
  const states: StateNode[] = []
  let stateCounter = 0
  let pos = 0
  let groupCount = 0
  const groupNames: (string | null)[] = [null]

  function newState(): number {
    const id = stateCounter++
    states.push({ id, isAccept: false, transitions: new Map(), epsilonTransitions: [] })
    return id
  }

  function addTransition(from: number, symbol: string, to: number) {
    if (!states[from].transitions.has(symbol)) {
      states[from].transitions.set(symbol, [])
    }
    states[from].transitions.get(symbol)!.push(to)
  }

  function addEpsilon(from: number, to: number) {
    states[from].epsilonTransitions.push(to)
  }

  function parseCharClass(): (ch: string) => boolean {
    const negative = pattern[pos] === '^'
    if (negative) pos++
    const ranges: [string, string][] = []
    const chars: string[] = []
    const predicates: ((ch: string) => boolean)[] = []
    // 读取一个转义单元：\uXXXX、\d\w\s（返回 null 并登记谓词）、其他转义按字面字符
    const readEscaped = (): string | null => {
      pos++ // skip backslash
      const e = pattern[pos]
      if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(pattern.substr(pos + 1, 4))) {
        const c = String.fromCharCode(parseInt(pattern.substr(pos + 1, 4), 16))
        pos += 5
        return c
      }
      if (e === 'd' || e === 'w' || e === 's') {
        predicates.push(e === 'd' ? (c => /\d/.test(c)) : e === 'w' ? (c => /\w/.test(c)) : (c => /\s/.test(c)))
        pos++
        return null
      }
      pos++
      return e
    }
    while (pos < pattern.length && pattern[pos] !== ']') {
      let c: string | null
      if (pattern[pos] === '\\') {
        c = readEscaped()
        if (c === null) continue
      } else {
        c = pattern[pos]
        pos++
      }
      if (pattern[pos] === '-' && pattern[pos + 1] && pattern[pos + 1] !== ']') {
        pos++ // skip -
        let end: string | null
        if (pattern[pos] === '\\') {
          end = readEscaped()
          if (end === null) { chars.push(c, '-'); continue }
        } else {
          end = pattern[pos]
          pos++
        }
        ranges.push([c, end])
      } else {
        chars.push(c)
      }
    }
    pos++ // skip ]
    return (ch: string) => {
      const hit = chars.includes(ch) || ranges.some(([s, e]) => ch >= s && ch <= e) || predicates.some(p => p(ch))
      return negative ? !hit : hit
    }
  }

  // 解析一个原子（分组/字符类/转义/点/锚点/普通字符），返回 [入口状态, 出口状态]
  function parseAtomSegment(): [number, number] {
    let segStart: number, segEnd: number
    const ch = pattern[pos]
    if (ch === '(') {
      pos++
      let capturing = true
      let groupName: string | null = null
      if (pattern[pos] === '?') {
        const next = pattern[pos + 1]
        if (next === ':') {
          pos += 2
          capturing = false
        } else if (next === '<' && pattern[pos + 2] !== '=' && pattern[pos + 2] !== '!') {
          // 命名分组 (?<name>...)
          pos += 2
          const nameStart = pos
          while (pos < pattern.length && pattern[pos] !== '>') pos++
          groupName = pattern.substring(nameStart, pos) || null
          if (pos < pattern.length) pos++ // skip >
        } else {
          // (?= (?! (?<= (?<! 等断言暂不支持，按非捕获组解析
          pos++
          capturing = false
        }
      }
      if (capturing) {
        groupCount++
        const gIdx = groupCount
        groupNames[gIdx] = groupName
        const gStart = newState()
        const gEnd = newState()
        states[gStart].groupMarker = { index: gIdx, type: 'open' }
        states[gEnd].groupMarker = { index: gIdx, type: 'close' }
        const [s, e] = parseOr()
        addEpsilon(gStart, s)
        addEpsilon(e, gEnd)
        segStart = gStart
        segEnd = gEnd
      } else {
        const [s, e] = parseOr()
        segStart = s
        segEnd = e
      }
      if (pattern[pos] === ')') pos++
    } else if (ch === '[') {
      pos++
      segStart = newState()
      segEnd = newState()
      const matcher = parseCharClass()
      addTransition(segStart, '__class_' + segStart, segEnd)
      states[segStart].classMatcher = matcher
    } else if (ch === '.') {
      segStart = newState()
      segEnd = newState()
      addTransition(segStart, '__dot', segEnd)
      pos++
    } else if (ch === '\\') {
      pos++
      const escaped = pattern[pos]
      segStart = newState()
      segEnd = newState()
      if (escaped === 'd') addTransition(segStart, '__digit', segEnd)
      else if (escaped === 'w') addTransition(segStart, '__word', segEnd)
      else if (escaped === 's') addTransition(segStart, '__space', segEnd)
      else addTransition(segStart, escaped, segEnd)
      pos++
    } else if (ch === '^' || ch === '$') {
      segStart = newState()
      segEnd = segStart
      pos++
    } else {
      segStart = newState()
      segEnd = newState()
      addTransition(segStart, ch, segEnd)
      pos++
    }
    return [segStart, segEnd]
  }

  // 解析 {n} {n,} {n,m}；语法无效时按旧逻辑跳过并返回 null
  function parseRepetitionSpec(): { min: number; max: number | null } | null {
    let p = pos + 1
    let minStr = ''
    while (p < pattern.length && /\d/.test(pattern[p])) { minStr += pattern[p]; p++ }
    if (minStr === '') { skipBraces(); return null }
    let max: number | null
    if (pattern[p] === ',') {
      p++
      let maxStr = ''
      while (p < pattern.length && /\d/.test(pattern[p])) { maxStr += pattern[p]; p++ }
      max = maxStr === '' ? null : parseInt(maxStr, 10)
    } else {
      max = parseInt(minStr, 10)
    }
    if (pattern[p] !== '}') { skipBraces(); return null }
    pos = p + 1
    const min = parseInt(minStr, 10)
    if (max !== null && max < min) return null
    if (min > MAX_REPEAT || (max !== null && max > MAX_REPEAT)) {
      throw new Error(`重复次数过大，最多支持 {${MAX_REPEAT}}`)
    }
    return { min, max }
  }

  function skipBraces() {
    while (pos < pattern.length && pattern[pos] !== '}') pos++
    if (pos < pattern.length) pos++
  }

  function parseConcat(): [number, number] {
    let start = newState()
    let end = start
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      const atomStart = pos
      const groupCountBeforeAtom = groupCount
      let [segStart, segEnd] = parseAtomSegment()

      // Handle quantifiers
      while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
        const q = pattern[pos]
        if (q === '{') {
          const rep = parseRepetitionSpec()
          if (rep) {
            const afterQuant = pos
            // 重新解析原子源码生成一个副本；分组编号复用，保证捕获语义为“最后一次迭代生效”
            const reparseAtom = (): [number, number] => {
              groupCount = groupCountBeforeAtom
              pos = atomStart
              return parseAtomSegment()
            }
            if (rep.min === 0 && rep.max === null) {
              // {0,} 等价于 *
              const qStart = newState()
              const qEnd = newState()
              addEpsilon(qStart, segStart)
              addEpsilon(qStart, qEnd)
              addEpsilon(segEnd, segStart)
              addEpsilon(segEnd, qEnd)
              segStart = qStart
              segEnd = qEnd
            } else {
              if (rep.min === 0) {
                // 第一份本身可选
                const qStart = newState()
                const qEnd = newState()
                addEpsilon(qStart, segStart)
                addEpsilon(qStart, qEnd)
                addEpsilon(segEnd, qEnd)
                segStart = qStart
                segEnd = qEnd
              } else {
                // 必需的其余副本
                for (let k = 2; k <= rep.min; k++) {
                  const [s, e] = reparseAtom()
                  addEpsilon(segEnd, s)
                  segEnd = e
                }
              }
              if (rep.max === null) {
                // {n,}：追加一个星号副本
                const [s, e] = reparseAtom()
                const qStart = newState()
                const qEnd = newState()
                addEpsilon(segEnd, qStart)
                addEpsilon(qStart, s)
                addEpsilon(qStart, qEnd)
                addEpsilon(e, s)
                addEpsilon(e, qEnd)
                segEnd = qEnd
              } else {
                // 可选副本 (min+1..max)，min 为 0 时从第 2 份开始
                const from = rep.min === 0 ? 2 : rep.min + 1
                for (let k = from; k <= rep.max; k++) {
                  const [s, e] = reparseAtom()
                  const qStart = newState()
                  const qEnd = newState()
                  addEpsilon(segEnd, qStart)
                  addEpsilon(qStart, s)
                  addEpsilon(qStart, qEnd)
                  addEpsilon(e, qEnd)
                  segEnd = qEnd
                }
              }
            }
            pos = afterQuant
            if (pos < pattern.length && pattern[pos] === '?') pos++ // lazy
            continue
          }
          continue // 无效 {..} 语法：忽略，保持旧行为
        }
        pos++
        const qStart = newState()
        const qEnd = newState()
        addEpsilon(qStart, segStart)
        if (q === '*') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, segStart); addEpsilon(segEnd, qEnd) }
        else if (q === '+') { addEpsilon(segEnd, segStart); addEpsilon(segEnd, qEnd) }
        else if (q === '?') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd) }
        segStart = qStart; segEnd = qEnd
        if (pos < pattern.length && pattern[pos] === '?') pos++ // lazy
      }

      if (end !== segStart) addEpsilon(end, segStart)
      end = segEnd
    }
    return [start, end]
  }

  function parseOr(): [number, number] {
    const [s1, e1] = parseConcat()
    let start = s1, end = e1
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const [s2, e2] = parseConcat()
      const ns = newState(), ne = newState()
      addEpsilon(ns, start); addEpsilon(ns, s2)
      addEpsilon(end, ne); addEpsilon(e2, ne)
      start = ns; end = ne
    }
    return [start, end]
  }

  const [startState, acceptState] = parseOr()
  states[acceptState].isAccept = true
  return { states, startState, acceptStates: [acceptState], groupCount, groupNames }
}

// 捕获感知的 ε 闭包：经过分组标记状态时记录该分组在当前位置的边界
function closureThreads(states: StateNode[], stateId: number, caps: Map<number, CaptureSpan>, pos: number): Thread[] {
  const result: Thread[] = []
  const visited = new Set<number>()
  const stack: Thread[] = [{ state: stateId, caps }]
  while (stack.length) {
    const t = stack.pop()!
    if (visited.has(t.state)) continue
    visited.add(t.state)
    let c = t.caps
    const marker = states[t.state].groupMarker
    if (marker) {
      c = new Map(t.caps)
      const entry: CaptureSpan = { ...c.get(marker.index) }
      if (marker.type === 'open') entry.start = pos
      else entry.end = pos
      c.set(marker.index, entry)
    }
    result.push({ state: t.state, caps: c })
    // 逆序入栈，保证先添加的 ε 边先被探索（贪婪优先级：进入/循环 优于 跳过/退出）
    const eps = states[t.state].epsilonTransitions
    for (let k = eps.length - 1; k >= 0; k--) {
      if (!visited.has(eps[k])) stack.push({ state: eps[k], caps: c })
    }
  }
  return result
}

function matchTransition(state: StateNode, symbol: string): number[] {
  const results: number[] = []
  for (const [sym, targets] of state.transitions) {
    if (sym === symbol) { results.push(...targets); continue }
    if (sym === '__dot' && symbol !== '\n') { results.push(...targets); continue }
    if (sym === '__digit' && /\d/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__word' && /\w/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__space' && /\s/.test(symbol)) { results.push(...targets); continue }
    if (sym.startsWith('__class_')) {
      if (state.classMatcher && state.classMatcher(symbol)) results.push(...targets)
    }
  }
  return results
}

function runMatch(states: StateNode[], startState: number, input: string, groupCount: number, groupNames: (string | null)[]): MatchResult {
  const steps: MatchStep[] = []
  let backtracks = 0
  let stepIndex = 0
  const startTime = performance.now()

  const findAccept = (threads: Thread[]): Thread | undefined => threads.find(t => states[t.state].isAccept)

  // Try to match from each position
  for (let startPos = 0; startPos <= input.length; startPos++) {
    let threads = closureThreads(states, startState, new Map(), startPos)
    let matched = false
    let matchEnd = startPos
    let matchedCaps: Map<number, CaptureSpan> | null = null

    const initialAccept = findAccept(threads)
    if (initialAccept) { matched = true; matchEnd = startPos; matchedCaps = initialAccept.caps }

    for (let i = startPos; i < input.length; i++) {
      const char = input[i]
      const nextThreads: Thread[] = []
      const seen = new Set<number>()

      for (const t of threads) {
        const targets = matchTransition(states[t.state], char)
        for (const target of targets) {
          for (const ct of closureThreads(states, target, t.caps, i + 1)) {
            if (!seen.has(ct.state)) {
              seen.add(ct.state)
              nextThreads.push(ct)
              steps.push({
                stepIndex: stepIndex++,
                charIndex: i,
                char,
                currentState: t.state,
                nextState: ct.state,
                transition: char,
                isBacktrack: false,
                isMatch: true
              })
            }
          }
        }
      }

      if (nextThreads.length === 0) {
        if (matched) break
        backtracks++
        steps.push({
          stepIndex: stepIndex++,
          charIndex: i,
          char,
          currentState: threads.length ? threads[0].state : -1,
          nextState: -1,
          transition: 'FAIL',
          isBacktrack: true,
          isMatch: false
        })
        break
      }

      threads = nextThreads
      const accept = findAccept(threads)
      if (accept) { matched = true; matchEnd = i + 1; matchedCaps = accept.caps }
    }

    if (matched && matchedCaps !== null) {
      const matchText = input.substring(startPos, matchEnd)
      const groups: GroupCapture[] = [{ index: 0, name: null, text: matchText, start: startPos, end: matchEnd }]
      for (let g = 1; g <= groupCount; g++) {
        const span = matchedCaps.get(g)
        const participated = !!span && span.start !== undefined && span.end !== undefined && span.end >= span.start
        groups.push({
          index: g,
          name: groupNames[g] ?? null,
          text: participated ? input.substring(span!.start!, span!.end!) : null,
          start: participated ? span!.start! : -1,
          end: participated ? span!.end! : -1
        })
      }
      const duration = performance.now() - startTime
      return {
        matched: true,
        matchText,
        matchStart: startPos,
        matchEnd,
        groups,
        steps,
        backtracks,
        totalSteps: stepIndex,
        duration: Math.round(duration * 100) / 100
      }
    }
  }

  const duration = performance.now() - startTime
  return { matched: false, matchText: '', matchStart: -1, matchEnd: -1, groups: [], steps, backtracks, totalSteps: stepIndex, duration: Math.round(duration * 100) / 100 }
}

export function computeNFA(nfaResult: ReturnType<typeof buildNFA>): NFA {
  const nodes = nfaResult.states.map((s, i) => ({
    id: s.id,
    isStart: i === nfaResult.startState,
    isAccept: nfaResult.acceptStates.includes(s.id),
    x: 0, y: 0
  }))

  // Layout: circular
  const cx = 400, cy = 300, radius = 200
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2
    n.x = cx + Math.cos(angle) * radius
    n.y = cy + Math.sin(angle) * radius
  })

  const transitions: any[] = []
  nfaResult.states.forEach(s => {
    s.transitions.forEach((targets, symbol) => {
      targets.forEach(t => {
        transitions.push({ from: s.id, to: t, symbol: symbol.startsWith('__') ? symbol.replace('__', '') : symbol, label: symbol.startsWith('__') ? symbol.replace('__', '') : symbol })
      })
    })
    s.epsilonTransitions.forEach(t => {
      transitions.push({ from: s.id, to: t, symbol: null, label: 'ε' })
    })
  })

  return { states: nodes, transitions, startState: nfaResult.startState, acceptStates: nfaResult.acceptStates }
}

export function parseAST(pattern: string): ASTNode {
  let pos = 0
  let groupIdx = 0

  function parseAtom(): ASTNode {
    const ch = pattern[pos]
    if (ch === '(') {
      pos++
      let capturing = true
      let name: string | undefined
      if (pattern[pos] === '?') {
        pos++
        if (pattern[pos] === ':') { pos++; capturing = false }
        else if (pattern[pos] === '<' && pattern[pos + 1] !== '=' && pattern[pos + 1] !== '!') {
          pos++
          const nameStart = pos
          while (pos < pattern.length && pattern[pos] !== '>') pos++
          name = pattern.substring(nameStart, pos) || undefined
          if (pos < pattern.length) pos++
        } else {
          capturing = false
        }
      }
      if (capturing) groupIdx++
      const node = parseOr()
      if (pattern[pos] === ')') pos++
      return { type: 'group', children: [node], groupIndex: capturing ? groupIdx : undefined, name }
    }
    if (ch === '[') {
      pos++
      let cls = ''
      while (pos < pattern.length && pattern[pos] !== ']') { cls += pattern[pos]; pos++ }
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
        while (pos < pattern.length && pattern[pos] !== '}') pos++
        pos++
      } else {
        pos++
      }
      const type = q === '*' ? 'star' : q === '+' ? 'plus' : 'question'
      node = { type, children: [node] }
      if (pos < pattern.length && pattern[pos] === '?') pos++
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

  const groupColors = GROUP_COLORS

  // 分组颜色：整体匹配固定绿色，分组 i 固定取色板第 i 色，保证任何情况下颜色稳定对应
  function groupColor(index: number): string {
    if (index <= 0) return WHOLE_MATCH_COLOR
    return GROUP_COLORS[(index - 1) % GROUP_COLORS.length]
  }

  const matchHighlight = computed(() => {
    const r = matchResult.value
    if (!r || !r.matched || r.matchStart < 0) return null
    const s = testString.value
    const start = Math.max(0, Math.min(r.matchStart, s.length))
    const end = Math.max(start, Math.min(r.matchEnd, s.length))
    // 按偏移量切分匹配区，每个字符归属最内层分组，保证步骤切换/播放时标注不错位
    const runs: HighlightRun[] = []
    for (let p = start; p < end; p++) {
      let best: number | null = null
      let bestLen = Infinity
      for (const g of r.groups) {
        if (g.index === 0 || g.text === null || g.start < 0) continue
        if (g.start <= p && p < g.end) {
          const len = g.end - g.start
          if (len < bestLen || (len === bestLen && best !== null && g.index > best)) {
            best = g.index
            bestLen = len
          }
        }
      }
      const last = runs[runs.length - 1]
      if (last && last.groupIndex === best) last.text += s[p]
      else runs.push({ text: s[p], groupIndex: best })
    }
    return { before: s.slice(0, start), after: s.slice(end), runs }
  })

  let playTimer: ReturnType<typeof setInterval> | null = null

  function execute() {
    stop()
    currentStep.value = 0
    error.value = ''
    try {
      const built = buildNFA(pattern.value)
      nfa.value = computeNFA(built)
      matchResult.value = runMatch(built.states, built.startState, testString.value, built.groupCount, built.groupNames)
      ast.value = parseAST(pattern.value)
    } catch (e: any) {
      error.value = e.message || '正则表达式解析错误'
      nfa.value = null
      matchResult.value = null
      ast.value = null
    }
  }

  function setPattern(p: string) {
    pattern.value = p
    execute()
  }

  function setTestString(s: string) {
    testString.value = s
    execute()
  }

  function applyTemplate(t: RegexTemplate) {
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
    if (playTimer !== null || !matchResult.value || matchResult.value.steps.length === 0) return
    isPlaying.value = true
    playTimer = setInterval(() => {
      if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
        currentStep.value++
      } else {
        stop()
      }
    }, 200)
  }

  function stop() {
    isPlaying.value = false
    if (playTimer !== null) {
      clearInterval(playTimer)
      playTimer = null
    }
  }

  return {
    pattern, testString, currentStep, isPlaying, nfa, matchResult, ast, error,
    selectedTemplate, groupColors, groupColor, matchHighlight,
    execute, setPattern, setTestString, applyTemplate,
    stepForward, stepBackward, resetStep, play, stop
  }
})
