<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <h3 class="text-sm font-bold text-slate-400 mb-3">匹配结果高亮</h3>
    <div v-if="store.error" class="text-red-400 text-sm">解析错误</div>
    <div v-else-if="store.matchHighlight" class="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
      <span class="text-slate-500 whitespace-pre-wrap break-all">{{ store.matchHighlight.before }}</span>
      <span
        class="rounded text-white"
        :class="store.matchHighlight.match ? 'bg-green-600 px-1' : 'inline-block align-middle border border-green-500 bg-green-600/30 w-2 h-4'"
      >{{ store.matchHighlight.match }}</span>
      <span class="text-slate-500 whitespace-pre-wrap break-all">{{ store.matchHighlight.after }}</span>
    </div>
    <div v-else-if="store.matchResult && !store.matchResult.matched" class="text-red-400 text-sm">未匹配到结果</div>
    <div v-else class="text-slate-500 text-sm">等待执行...</div>

    <div v-if="store.matchResult" class="mt-4">
      <h4 class="text-xs font-bold text-slate-500 mb-2">
        分组捕获 ({{ store.matchResult.groups.length - 1 }} 个捕获分组)
      </h4>
      <div class="space-y-1">
        <div
          v-for="group in store.matchResult.groups"
          :key="group.index"
          class="flex items-start gap-2 text-sm rounded px-2 py-1"
          :class="group.status === 'unmatched' ? 'bg-slate-900/40 opacity-75' : 'bg-slate-900'"
        >
          <span
            class="mt-0.5 inline-block w-4 h-4 rounded shrink-0 border"
            :style="{
              backgroundColor: group.status === 'unmatched' ? 'transparent' : store.getGroupColor(group.index),
              borderColor: store.getGroupColor(group.index)
            }"
          ></span>
          <span class="w-24 shrink-0 text-slate-400 leading-5">
            <template v-if="group.index === 0">整体匹配</template>
            <template v-else-if="group.name">{{ group.name }}</template>
            <template v-else>分组 {{ group.index }}</template>
            <span v-if="group.index !== 0 && group.name" class="block text-[10px] text-slate-600">#{{ group.index }}</span>
          </span>
          <span
            class="font-mono px-2 py-0.5 rounded min-w-[2rem] break-all whitespace-pre-wrap"
            :class="group.status === 'unmatched' ? 'text-slate-500 border border-dashed border-slate-700' : 'text-slate-200'"
          >
            <template v-if="group.status === 'unmatched'">— 未参与</template>
            <template v-else-if="group.status === 'empty'">∅ 空捕获</template>
            <template v-else>{{ group.content }}</template>
          </span>
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

const store = useRegexStore()
const recentSteps = computed(() => {
  if (!store.matchResult) return []
  const end = Math.min(store.currentStep + 1, store.matchResult.steps.length)
  return store.matchResult.steps.slice(Math.max(0, end - 5), end)
})
</script>
