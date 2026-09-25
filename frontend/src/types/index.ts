export interface NFAState {
  id: number
  isStart: boolean
  isAccept: boolean
  x: number
  y: number
}

export interface NFATransition {
  from: number
  to: number
  symbol: string | null // null = epsilon
  label: string
}

export interface NFA {
  states: NFAState[]
  transitions: NFATransition[]
  startState: number
  acceptStates: number[]
}

export interface MatchStep {
  stepIndex: number
  charIndex: number
  char: string
  currentState: number
  nextState: number
  transition: string
  isBacktrack: boolean
  isMatch: boolean
}

export interface GroupCapture {
  index: number // 0 = 整体匹配，1..N = 捕获分组
  name: string | null // 命名分组名，未命名为 null
  text: string | null // null = 该分组未参与匹配；'' = 参与但捕获为空
  start: number // 在测试字符串中的起始偏移，未参与为 -1
  end: number // 结束偏移（不含），未参与为 -1
}

export interface MatchResult {
  matched: boolean
  matchText: string
  matchStart: number
  matchEnd: number
  groups: GroupCapture[]
  steps: MatchStep[]
  backtracks: number
  totalSteps: number
  duration: number
}

export interface HighlightRun {
  text: string
  groupIndex: number | null // null = 整体匹配内不属于任何分组的片段
}

export interface RegexTemplate {
  name: string
  pattern: string
  description: string
  testString: string
  category: string
}

export interface ASTNode {
  type: 'char' | 'star' | 'plus' | 'question' | 'or' | 'concat' | 'group' | 'dot' | 'anchor' | 'charclass' | 'digit' | 'word' | 'space'
  value?: string
  children?: ASTNode[]
  groupIndex?: number
  name?: string
}
