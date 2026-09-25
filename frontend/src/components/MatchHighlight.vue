<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <h3 class="text-sm font-bold text-slate-400 mb-3">匹配结果高亮</h3>
    <div v-if="store.error" class="text-red-400 text-sm">解析错误</div>
    <div v-else-if="store.matchHighlight" class="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap break-all"><span class="text-slate-500">{{ store.matchHighlight.before }}</span><span class="bg-green-600 text-white px-1 rounded" title="整体匹配"><template v-for="(run, i) in store.matchHighlight.runs" :key="i"><span v-if="run.groupIndex !== null" class="rounded-sm" :style="{ backgroundColor: store.groupColor(run.groupIndex) }" :title="runTitle(run.groupIndex)">{{ run.text }}</span><span v-else>{{ run.text }}</span></template><span v-if="store.matchHighlight.runs.length === 0" class="inline-block w-0.5 h-4 align-middle bg-green-300 rounded"></span></span><span class="text-slate-500">{{ store.matchHighlight.after }}</span></div>
    <div v-else-if="store.matchResult && !store.matchResult.matched" class="text-red-400 text-sm">未匹配到结果</div>
    <div v-else class="text-slate-500 text-sm">等待执行...</div>

    <div v-if="store.matchResult && store.matchResult.matched" class="mt-4">
      <h4 class="text-xs font-bold text-slate-500 mb-2">分组捕获 ({{ captureCount }})</h4>
      <div class="space-y-1">
        <div v-for="group in groups" :key="group.index" class="flex items-center gap-2 text-sm">
          <span class="inline-block w-4 h-4 rounded shrink-0" :style="{ backgroundColor: store.groupColor(group.index) }"></span>
          <span class="text-slate-500 w-36 truncate shrink-0" :title="groupLabel(group)">{{ groupLabel(group) }}</span>
          <template v-if="group.text !== null">
            <span class="text-slate-200 font-mono bg-slate-900 px-2 py-0.5 rounded break-all">"{{ group.text }}"</span>
            <span v-if="group.text === ''" class="text-slate-500 text-xs shrink-0">(空)</span>
            <span class="text-slate-600 text-xs font-mono shrink-0">[{{ group.start }}, {{ group.end }})</span>
          </template>
          <span v-else class="text-slate-500 font-mono bg-slate-900/60 px-2 py-0.5 rounded italic">∅ 未参与</span>
        </div>
      </div>
    </div>

    <div v-if="store.matchResult && store.matchResult.steps.length > 0" class="mt-4">
      <h4 class="text-xs font-bold text-slate-500 mb-2">执行步骤 (最近5步)</h4>
      <div class="space-y-1 max-h-32 overflow-y-auto">
        <div v-for="step in recentSteps" :key="step.stepIndex"
          class="text-xs font-mono px-2 py-1 rounded"
          :class="step.isBacktrack ? 'bg-orange-900 text-orange-300' : step.stepIndex === store.currentStep ? 'bg-cyan-900 text-cyan-300' : 'bg-slate-900 text-slate-400'">
          [{{ step.stepIndex }}] '{{ step.char }}' → 状态{{ step.currentState}}→{{ step.nextState }} ({{ step.transition }}){{ step.isBacktrack ? ' ⚠回溯' : '' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRegexStore } from '../store/regex'
import type { GroupCapture } from '../types'

const store = useRegexStore()

const groups = computed<GroupCapture[]>(() => store.matchResult?.groups ?? [])
const captureCount = computed(() => Math.max(0, groups.value.length - 1))

function groupLabel(g: GroupCapture | undefined): string {
  if (!g) return ''
  if (g.index === 0) return '整体匹配'
  return g.name ? `Group ${g.index} (${g.name})` : `Group ${g.index}`
}

function runTitle(index: number): string {
  return groupLabel(groups.value.find(g => g.index === index))
}

const recentSteps = computed(() => {
  if (!store.matchResult) return []
  const end = store.currentStep + 1
  return store.matchResult.steps.slice(Math.max(0, end - 5), end)
})
</script>
