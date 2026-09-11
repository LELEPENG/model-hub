/* ============================================================
 * model-hub / data.js
 * 大模型一站式接入教程站 —— 数据层
 * 数据核实日期：2026-09-11
 * 来源：OpenAI / Anthropic 官方文档、Ollama 库、RTX 4080 16GB 实测榜、
 *       NVIDIA NIM / Google AI Studio / Groq 免费额度页、computingforgeeks 开源模型对照表
 * 维护约定：任何字段变更请同步 updated 字段；status=untested 的条目会在页面上打「待实测」标
 * ============================================================ */

const DATA_VERSION = '2026.09.11';

/* ---------- 硬件档位 ---------- */
const TIERS = [
  {
    id: 'cpu',
    label: '无独显 / 核显',
    hint: '内存 8-16GB，纯 CPU 推理',
    icon: '🖥️',
    rule: '选 2B-4B 量化模型，接受 5-15 tok/s。别碰 7B 以上，会卡到怀疑人生。',
    picks: ['gemma3-4b', 'minicpm-v4-6', 'qwen3-2b', 'smollm3-3b', 'phi4-mini', 'deepseek-r1-1-5b'],
    note: 'CPU 跑模型是能用，不是好用。真要生产力，最低门槛是 8GB 独显。'
  },
  {
    id: 't4',
    label: '4GB 显存',
    hint: 'GTX 1650 / 笔记本入门独显',
    icon: '🎴',
    rule: '3B-4B 模型，Q4 量化，短上下文（4K 以内）。',
    picks: ['gemma3-4b', 'qwen3-vl-4b', 'qwen3-2b', 'phi4-mini', 'minicpm-v4-6', 'deepseek-r1-1-5b'],
    note: '4GB 只够跑一个 4B 模型 + 少量上下文，别开长对话。'
  },
  {
    id: 't8',
    label: '8GB 显存',
    hint: 'RTX 3050 / 4060 / 3060',
    icon: '🎴',
    rule: '7B-8B 模型 Q4 是甜点区，能跑到 30-60 tok/s。',
    picks: ['qwen3-8b', 'deepseek-r1-8b', 'qwen3-vl-4b', 'gemma3-4b', 'phi4-mini', 'minicpm-v4-6'],
    note: '8GB 是本地 AI 的真正入门线。Q4_K_M 量化，别贪 Q8。'
  },
  {
    id: 't12',
    label: '12GB 显存',
    hint: 'RTX 3060 12G / 4070',
    icon: '🎴',
    rule: '可以上 14B Q4（约 9GB），留 3GB 给上下文。',
    picks: ['qwen3-14b', 'phi4-14b', 'deepseek-r1-14b', 'ministral-3-14b', 'qwen3-vl-8b', 'qwen3-8b'],
    note: '14B 是 12GB 的天花板，再大就要卸载到内存。'
  },
  {
    id: 't16',
    label: '16GB 显存',
    hint: 'RTX 4080 / 4080 SUPER / 5070 Ti ⭐ 最常见的高配',
    icon: '🔥',
    rule: '铁律：模型文件 ≤15GB 才能 100% 装进 VRAM。超过就 CPU 卸载，速度掉 3-10 倍。优先 MoE 架构（激活参数小、体积紧）。',
    picks: ['gpt-oss-20b', 'qwen3-14b', 'ministral-3-14b', 'phi4-14b', 'deepseek-r1-14b', 'qwen3-vl-8b'],
    note: '16GB 实测：gpt-oss:20b 139.93 tok/s（100% GPU） vs gpt-oss:120b 12.64 tok/s（78% CPU 卸载）——11 倍差距。选能全装进去的，不选参数最大的。'
  },
  {
    id: 't24',
    label: '24GB 显存',
    hint: 'RTX 3090 / 4090',
    icon: '🔥',
    rule: '27B-32B Q4 自由跑，18-20GB 占用，还剩 4-6GB 给上下文。',
    picks: ['qwen3-8-27b', 'qwen3-coder-30b', 'deepseek-r1-32b', 'mistral-small-3-2', 'qwen3-vl-30b', 'qwen3-omni-30b'],
    note: '24GB 是本地跑旗舰开源模型的分水岭，qwen3.8:27b 是这一档的综合最优。'
  },
  {
    id: 't32',
    label: '32GB+ 显存',
    hint: '双卡 / RTX 5090 / 大内存 Mac',
    icon: '🚀',
    rule: '可以跑 Q8 精度的 27B（30GB），或同时常驻两个模型。',
    picks: ['qwen3-8-27b-q8', 'gemma4-31b', 'qwen3-8-27b', 'qwen3-omni-30b', 'deepseek-r1-32b', 'mistral-small-3-2'],
    note: '到这一档，瓶颈从显存变成上下文长度管理。'
  },
  {
    id: 'tserver',
    label: '服务器 / 多卡',
    hint: '128GB+ 内存 / 多 GPU',
    icon: '🏢',
    rule: '上 MoE 大模型：Qwen3.8 Flash Next(128GB)、GLM 5.3 Flash(384GB)、DeepSeek V4 Pro。',
    picks: ['deepseek-v4-flash', 'glm-5-3-flash', 'llama-4-maverick', 'qwen3-8-flash-next', 'kimi-k3', 'minimax-m3'],
    note: '个人用户其实不必硬上——同样的模型用 NVIDIA NIM 免费 API 更划算。'
  }
];

/* ---------- 需求场景 ---------- */
const NEEDS = [
  {
    id: 'coding',
    label: '写代码',
    icon: '💻',
    free: ['qwen3-coder-30b', 'gpt-oss-20b', 'qwen3-14b', 'nvidia-nim', 'groq', 'deepseek-r1-8b'],
    paid: ['claude-opus-5', 'gpt6-astra', 'claude-sonnet-5', 'kimi-k3', 'minimax-m3', 'gpt56-sol'],
    why: '编码看两件事：长上下文 + 工具调用稳定性。本地 24GB 上 qwen3-coder:30b，16GB 上 gpt-oss:20b；云端最强档是 Claude Opus 5（Arena Code Elo 全球第一 1711.88）与 GPT-6 Astra，追求性价比选 Kimi K3（全球第二 1681.75，价格低 70%）。'
  },
  {
    id: 'agent',
    label: 'Agent / 自动跑任务',
    icon: '🤖',
    free: ['glm-5-3-flash', 'gpt-oss-20b', 'qwen3-14b', 'nvidia-nim', 'openrouter', 'deepseek-v4-flash'],
    paid: ['claude-fable-5-1', 'gpt6-astra', 'kimi-k3', 'claude-opus-5', 'minimax-m3', 'gpt56-sol'],
    why: '长链路任务要「不迷路」。Fable 5.1 是 Anthropic 为长程 Agent 设计的顶配（多榜第一）；预算有限用 GLM-5.3-Flash（1M 上下文、MIT 许可）或 MiniMax-M3（工具调用稳定）。'
  },
  {
    id: 'chat',
    label: '日常对话 / 写作',
    icon: '💬',
    free: ['qwen3-14b', 'ministral-3-14b', 'gemma3-4b', 'qwen3-2b', 'gemini-ai-studio', 'nvidia-nim'],
    paid: ['claude-sonnet-5', 'gpt56-terra', 'claude-haiku-4-5', 'gpt56-sol', 'gpt6-astra', 'qwen3-8-flash-next'],
    why: '日常用不必追旗舰。本地 16GB 跑 qwen3:14b（中文好、指令遵循强），纯 CPU 就 qwen3:2b；云端免费 Gemini 3.6 Flash 每天 1500 次够用；要质感上 Claude Sonnet 5，要便宜上 GPT-5.6 Terra。'
  },
  {
    id: 'reasoning',
    label: '推理 / 数学',
    icon: '🧮',
    free: ['deepseek-r1-14b', 'deepseek-r1-8b', 'qwen3-14b', 'phi4-mini', 'nvidia-nim', 'deepseek-v4-flash'],
    paid: ['gpt6-astra', 'claude-opus-5', 'claude-fable-5-1', 'gpt56-sol', 'kimi-k3', 'deepseek-official'],
    why: '要显式思维链就用 R1 系蒸馏模型（8B 起步，14B 更稳）；要极限分数，GPT-6 Astra 在推理榜拿满分档表现，Claude Opus 5 与 Fable 5.1 紧随其后。'
  },
  {
    id: 'vision',
    label: '看图 / 多模态',
    icon: '👁️',
    free: ['qwen3-vl-8b', 'minicpm-v4-6', 'qwen3-vl-4b', 'gemma3-4b', 'gemini-ai-studio', 'llama-4-maverick'],
    paid: ['claude-sonnet-5', 'gpt6-astra', 'gpt56-terra', 'claude-opus-5', 'qwen3-8-flash-next', 'llama-4-maverick'],
    why: '文档类图片用 MiniCPM-V4（6B 极小、OCR 强）；通用图片理解 qwen3-vl:8b；视频 / 超长多模态交 Gemini（1M 上下文免费档）；要开源可迁移就 Llama 4 Maverick。'
  },
  {
    id: 'privacy',
    label: '隐私 / 完全离线',
    icon: '🔒',
    free: ['gpt-oss-20b', 'qwen3-14b', 'ministral-3-14b', 'phi4-14b', 'qwen3-2b', 'deepseek-r1-8b'],
    paid: [],
    why: '合同、病历、未公开代码——只能本地。这一栏没有「付费方案」，因为只要数据出网就不叫隐私。注意 NVIDIA NIM 免费层条款允许用你的输入输出改进其模型，敏感数据别走免费云。'
  },
  {
    id: 'longctx',
    label: '长文档 / 整本书',
    icon: '📚',
    free: ['gemini-ai-studio', 'glm-5-3-flash', 'deepseek-v4-flash', 'qwen3-14b', 'phi4-mini', 'llama-4-maverick'],
    paid: ['claude-opus-5', 'gpt6-astra', 'kimi-k3', 'claude-fable-5-1', 'qwen3-8-flash-next', 'minimax-m3'],
    why: '免费档 Gemini 3.6 Flash 给 1M 上下文 + 每天 1500 请求，是长文档最划算的解；GLM-5.3-Flash 与 DeepSeek V4 Flash 同为 1M 级。本地想做长上下文显存压力极大，最多用 phi4-mini（128K）这种小模型顶一下。'
  }
];

/* ---------- 模型库 ---------- */
/* status: verified=已实测 / community=社区反馈 / untested=待实测（欢迎在实验室留言） */
const MODELS = [
  /* ===== 本地模型 ===== */
  {
    id: 'gpt-oss-20b',
    name: 'gpt-oss:20b',
    vendor: 'OpenAI（开源权重）',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['chat', 'coding', 'agent'],
    hw: ['t16'],
    vram: '13-14GB（Q4_K_M）',
    ctx: '131K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '16GB 显存的速度之王，MoE 架构把 20B 压进 13GB，100% 装进 VRAM。',
    bestFor: '交互聊天、快速代码生成。16GB 机器想「性能拉满」，这是第一个该装的。',
    install: {
      cmd: 'ollama pull gpt-oss:20b\nollama run gpt-oss:20b',
      verify: '跑一句「用 Python 写个快速排序并解释」，应该在 1 秒内开始出字，速度约 120-140 tok/s。',
      tune: '设置 OLLAMA_KEEP_ALIVE=-1 让模型常驻显存，实测首字延迟从 5.2s 降到 0.9s。\n再配 OLLAMA_FLASH_ATTENTION=1 拉长上下文。'
    },
    api: null,
    pitfalls: [
      '120B 版本（66GB）在 16GB 卡上会 78% 卸载到 CPU，只有 12.64 tok/s，别被参数迷惑。',
      '首次 pull 约 13GB，确保 OLLAMA_MODELS 指向非系统盘，否则 C 盘爆炸。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-14b',
    name: 'qwen3:14b',
    vendor: '阿里 通义千问',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['chat', 'coding', 'reasoning'],
    hw: ['t12', 't16', 't24'],
    vram: '9.3GB（Q4_K_M）',
    ctx: '131K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '16GB 档指令遵循最好、中文最强的综合模型，61.85 tok/s。',
    bestFor: '中文写作、日常问答、代码解释。想「什么都还行」就装它。',
    install: {
      cmd: 'ollama pull qwen3:14b\nollama run qwen3:14b',
      verify: '让它用中文写一封请假邮件并润色两版，看是否严格按你的格式要求输出。',
      tune: '16GB 卡可试 Q5_K_M（约 11GB）换取更好质量，但上下文要压到 8K 以内。'
    },
    api: null,
    pitfalls: [
      '上下文开太长会挤爆显存，14B 在 16GB 上建议 num-ctx 控制在 8192-16384。',
      '同时开浏览器硬件加速 + 模型，容易 OOM，跑模型前先关掉吃显存的程序。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'ministral-3-14b',
    name: 'ministral-3:14b',
    vendor: 'Mistral AI',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['chat', 'coding'],
    hw: ['t16'],
    vram: '13GB',
    ctx: '128K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '70.13 tok/s，Mistral 系的文风质量 + 16GB 全装载速度。',
    bestFor: '追求「又快又好看」的日常使用，英文写作质感优于同档。',
    install: {
      cmd: 'ollama pull ministral-3:14b\nollama run ministral-3:14b',
      verify: '中英混排写一段产品文案，观察语言自然度。',
      tune: '与 qwen3:14b 二选一常驻即可，16GB 不建议同时挂两个 14B。'
    },
    api: null,
    pitfalls: ['中文能力略逊于 qwen 系，纯中文场景优先 qwen3:14b。'],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-8b',
    name: 'qwen3:8b',
    vendor: '阿里 通义千问',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['chat', 'coding'],
    hw: ['t8', 't12'],
    vram: '5-6GB',
    ctx: '131K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '8GB 显存 / 16GB 内存的入门首选，8B 里综合最强。',
    bestFor: '老机器、笔记本、只想先跑通流程的新手。',
    install: {
      cmd: 'ollama pull qwen3:8b\nollama run qwen3:8b',
      verify: '问一个需要三步推理的问题，看是否逻辑连贯。',
      tune: '8GB 卡建议 num-ctx 4096，把显存留给权重。'
    },
    api: null,
    pitfalls: ['8B 在复杂多步任务上会明显掉链子，别拿它跑 agent。'],
    updated: '2026-09-11'
  },
  {
    id: 'gemma3-4b',
    name: 'gemma3:4b',
    vendor: 'Google DeepMind',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['chat'],
    hw: ['cpu', 't4', 't8'],
    vram: '3.3GB',
    ctx: '128K',
    license: 'Gemma 许可（可商用，有附加条款）',
    price: '免费',
    oneLiner: '4GB 显存甚至纯 CPU 都能跑的轻量选手。',
    bestFor: '低配机器、嵌入式、只是想体验本地模型。',
    install: {
      cmd: 'ollama pull gemma3:4b\nollama run gemma3:4b',
      verify: '简单问答应在数秒内出字；CPU 模式约 5-15 tok/s 属正常。',
      tune: '纯 CPU 时注意散热，长时间推理会撞温度墙。'
    },
    api: null,
    pitfalls: [
      'Gemma 系列不是纯 Apache/MIT，商用前务必读一遍许可条款。',
      '中文能力弱于 qwen 同尺寸，中文场景别选它。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'minicpm-v4-6',
    name: 'minicpm-v4.6',
    vendor: 'OpenBMB / 面壁智能',
    kind: 'local',
    tier: 'free',
    status: 'community',
    tags: ['vision', 'chat'],
    hw: ['cpu', 't4'],
    vram: '1.6GB',
    ctx: '256K',
    license: '待核实',
    price: '免费',
    oneLiner: '1.6GB 的极小视觉模型，4GB 档甚至手机都能跑。',
    bestFor: '极限轻量设备、需要看图但显存紧张。',
    install: {
      cmd: 'ollama pull minicpm-v4.6\nollama run minicpm-v4.6',
      verify: '喂一张截图让它描述内容。',
      tune: '视觉模型记得在下载体积上额外预留 1-2GB 给视觉投影层和图片 token。'
    },
    api: null,
    pitfalls: ['许可条款未经本站核实，商用前请自行确认——欢迎在实验室补充。'],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-vl-8b',
    name: 'qwen3-vl:8b',
    vendor: '阿里 通义千问',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['vision'],
    hw: ['t12', 't16'],
    vram: '6.1GB',
    ctx: '256K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '12GB 卡上每 GB 显存换来的最佳视觉质量。',
    bestFor: '截图理解、图片问答、UI 分析。',
    install: {
      cmd: 'ollama pull qwen3-vl:8b\nollama run qwen3-vl:8b',
      verify: '传一张带表格的截图，让它提取成 Markdown。',
      tune: '文档类图片优先用 glm-ocr（2.2GB），效果比通用视觉模型更好还更省。'
    },
    api: null,
    pitfalls: ['图片越大越吃显存，大图先压缩再喂。'],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-vl-4b',
    name: 'qwen3-vl:4b',
    vendor: '阿里 通义千问',
    kind: 'local',
    tier: 'free',
    status: 'community',
    tags: ['vision'],
    hw: ['t4', 't8'],
    vram: '3.3GB',
    ctx: '256K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '8GB 档的甜点视觉模型，留足余量。',
    bestFor: '8GB 显存想跑看图。',
    install: { cmd: 'ollama pull qwen3-vl:4b\nollama run qwen3-vl:4b', verify: '同 8b 版本。', tune: '' },
    api: null,
    pitfalls: [],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-vl-30b',
    name: 'qwen3-vl:30b-a3b',
    vendor: '阿里 通义千问',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['vision', 'coding'],
    hw: ['t16', 't24'],
    vram: '22GB（16GB 卡上 30% 卸载）',
    ctx: '256K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '16GB 上会部分卸载但仍跑 50.99 tok/s，多模态里性价比意外地高。',
    bestFor: '16GB 想跑强多模态，能接受一定卸载损耗。',
    install: {
      cmd: 'ollama pull qwen3-vl:30b-a3b\nollama run qwen3-vl:30b-a3b',
      verify: '传一张复杂图表让它总结趋势。',
      tune: '22GB 体积在 16GB 卡上必然卸载，介意速度就退回 qwen3-vl:8b。'
    },
    api: null,
    pitfalls: ['22GB 装不进 16GB 显存，会有约 30% 层跑在 CPU，别期待满速。'],
    updated: '2026-09-11'
  },
  {
    id: 'phi4-14b',
    name: 'phi4:14b',
    vendor: 'Microsoft',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['reasoning', 'coding'],
    hw: ['t12', 't16'],
    vram: '9.1GB',
    ctx: '16K',
    license: 'MIT',
    price: '免费',
    oneLiner: 'MIT 许可的小钢炮，STEM 和推理能力超出体积。',
    bestFor: '数学、逻辑题、单元测试生成，以及最宽松的商用许可需求。',
    install: {
      cmd: 'ollama pull phi4:14b\nollama run phi4:14b',
      verify: '出一道需要多步推导的数学题看过程是否严谨。',
      tune: '上下文只有 16K，长对话任务别用它。'
    },
    api: null,
    pitfalls: ['16K 上下文是硬伤，长文档场景直接排除。'],
    updated: '2026-09-11'
  },
  {
    id: 'deepseek-r1-14b',
    name: 'deepseek-r1:14b',
    vendor: 'DeepSeek',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['reasoning'],
    hw: ['t12', 't16', 't24'],
    vram: '9GB',
    ctx: '66K',
    license: 'MIT',
    price: '免费',
    oneLiner: '会输出完整思维链的推理模型，调试和算法题好帮手。',
    bestFor: '想看懂模型「怎么想的」——调试、算法、逐步推导。',
    install: {
      cmd: 'ollama pull deepseek-r1:14b\nollama run deepseek-r1:14b',
      verify: '问一道逻辑陷阱题，观察它是否自我纠错。',
      tune: 'R1 会输出 <think> 块，接应用时记得过滤或保留展示。'
    },
    api: null,
    pitfalls: ['思维链会消耗额外 token，聊天体感「慢」，是特性不是 bug。'],
    updated: '2026-09-11'
  },
  {
    id: 'mistral-small-3-2',
    name: 'mistral-small:3.2',
    vendor: 'Mistral AI',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['chat', 'coding'],
    hw: ['t16', 't24'],
    vram: '19GB（16GB 卡上 18% 卸载）',
    ctx: '128K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '语言质量最好的 24B，16GB 上跑 18.51 tok/s。',
    bestFor: '对文笔质量要求高于速度的场景（批处理、长文生成）。',
    install: {
      cmd: 'ollama pull mistral-small:3.2\nollama run mistral-small:3.2',
      verify: '让它写一段有文风的散文，比较与 14B 模型的语感差距。',
      tune: '19GB 在 16GB 卡上会卸载 18%，交互场景不推荐，批处理合适。'
    },
    api: null,
    pitfalls: ['中英法三语强，但中文不如 qwen 系。'],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-8-27b',
    name: 'qwen3.8:27b',
    vendor: '阿里 通义千问',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['coding', 'agent', 'vision', 'chat'],
    hw: ['t24', 't32'],
    vram: '18GB（Q4）',
    ctx: '1.01M',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '2026 年 24GB 档的综合最优：编码、agent、视觉、1M 上下文全包。',
    bestFor: '24GB 卡用户，一台机器覆盖几乎所有本地需求。',
    install: {
      cmd: 'ollama pull qwen3.8:27b\nollama run qwen3.8:27b',
      verify: 'SWE-bench 级别的任务可试：给一个真实 bug 让它定位并修。',
      tune: '32GB 显存可上 q8_0 版本（30GB），质量更好。'
    },
    api: null,
    pitfalls: [
      '18GB 体积注定与 16GB 卡无缘，24GB 是起步线。',
      '注意：阿里 2026-08 起对部分 Qwen 旗舰改动了许可条款，商用前再次确认当前协议。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-coder-30b',
    name: 'qwen3-coder:30b-a3b',
    vendor: '阿里 通义千问',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['coding', 'agent'],
    hw: ['t24'],
    vram: '18GB',
    ctx: '262K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '本地编码专用模型，工具调用成熟，LiveCodeBench 74%。',
    bestFor: '24GB 卡 + Continue/Cline/Aider 做仓库级代码任务。',
    install: {
      cmd: 'ollama pull qwen3-coder:30b\nollama run qwen3-coder:30b',
      verify: '在 Continue.dev 里配 provider=ollama, model=qwen3-coder:30b，让它改一个真实函数。',
      tune: '配 Continue.dev / Cline 时，把 context length 设到 64K 以上效果更好。'
    },
    api: null,
    pitfalls: ['30B-A3B 是 MoE，体积 18GB，16GB 卡跑不动（实测仅 5.5 tok/s）。'],
    updated: '2026-09-11'
  },
  {
    id: 'deepseek-r1-32b',
    name: 'deepseek-r1:32b',
    vendor: 'DeepSeek',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['reasoning', 'coding'],
    hw: ['t24', 't32'],
    vram: '24GB',
    ctx: '66K',
    license: 'MIT',
    price: '免费',
    oneLiner: '24GB 档的推理专家，算法与调试。',
    bestFor: '需要强推理且愿意等（速度慢于 14B 一半）。',
    install: { cmd: 'ollama pull deepseek-r1:32b\nollama run deepseek-r1:32b', verify: '同 14b。', tune: '' },
    api: null,
    pitfalls: ['24GB 占用在 24GB 卡上几乎没有上下文余量，建议 num-ctx 保守设置。'],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-8-27b-q8',
    name: 'qwen3.8:27b-q8_0',
    vendor: '阿里 通义千问',
    kind: 'local',
    tier: 'free',
    status: 'community',
    tags: ['coding', 'agent'],
    hw: ['t32'],
    vram: '30GB',
    ctx: '256K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '32GB 显存档：同模型 8bit 版，质量优先于速度。',
    bestFor: '32GB+ 显存，且任务对精度敏感。',
    install: { cmd: 'ollama pull qwen3.8:27b-q8_0\nollama run qwen3.8:27b-q8_0', verify: '同 27b。', tune: '' },
    api: null,
    pitfalls: ['30GB 占用，32GB 卡也要小心上下文挤占。'],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-2b',
    name: 'qwen3:2b',
    vendor: '阿里 通义千问',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['chat', 'coding'],
    hw: ['cpu', 't4', 't8'],
    vram: '1.9GB（Q4_K_M）',
    ctx: '32K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '2B 里中文最稳的一个，1.9GB 体积，纯 CPU 也能跑到 20-30 tok/s。',
    bestFor: '无独显机器的日常问答、轻量摘要、给大模型做「草稿机」。',
    install: {
      cmd: 'ollama pull qwen3:2b\nollama run qwen3:2b',
      verify: '问一个中文常识问题，2 秒内应该开始出字。',
      tune: 'CPU 机器上设置 OLLAMA_NUM_THREADS 为物理核心数，别用默认值。'
    },
    api: null,
    pitfalls: ['逻辑推理和长文能力有限，别拿它做需要多步推导的活。'],
    updated: '2026-09-11'
  },
  {
    id: 'smollm3-3b',
    name: 'smollm3:3b',
    vendor: 'Hugging Face',
    kind: 'local',
    tier: 'free',
    status: 'community',
    tags: ['chat', 'reasoning'],
    hw: ['cpu', 't4'],
    vram: '2.2GB',
    ctx: '64K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '3B 档里少见的「能开/关思维链」模型，64K 上下文超出同体量一大截。',
    bestFor: '在树莓派、老笔记本、纯 CPU 环境做推理类小任务。',
    install: {
      cmd: 'ollama pull smollm3:3b\nollama run smollm3:3b',
      verify: '问一道需要两步计算的应用题，看它是否给出推理过程。',
      tune: '不需要推理时在提示词里关掉 thinking，速度能翻倍。'
    },
    api: null,
    pitfalls: ['中文语料占比低于 qwen 系，纯中文写作优先 qwen3:2b。'],
    updated: '2026-09-11'
  },
  {
    id: 'phi4-mini',
    name: 'phi4-mini:3.8b',
    vendor: 'Microsoft',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['coding', 'reasoning', 'chat'],
    hw: ['cpu', 't4', 't8'],
    vram: '2.8GB',
    ctx: '128K',
    license: 'MIT',
    price: '免费',
    oneLiner: '3.8B 给 128K 上下文，小模型里罕见的「长上下文 + 代码」组合。',
    bestFor: '低配机器跑代码补全、函数级重构、批量文本清洗。',
    install: {
      cmd: 'ollama pull phi4-mini\nollama run phi4-mini',
      verify: '丢一段 200 行代码让它找 bug，看定位是否准确。',
      tune: '做批量任务时把 num-ctx 直接拉到 32768，2.8GB 模型扛得住。'
    },
    api: null,
    pitfalls: ['创意写作偏「教科书味」，文案类任务别选它。'],
    updated: '2026-09-11'
  },
  {
    id: 'deepseek-r1-1-5b',
    name: 'deepseek-r1:1.5b',
    vendor: 'DeepSeek',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['reasoning'],
    hw: ['cpu', 't4'],
    vram: '1.1GB',
    ctx: '32K',
    license: 'MIT',
    price: '免费',
    oneLiner: '1.1GB 就能跑的思维链模型，所有档位都能当「备用推理引擎」。',
    bestFor: '极低配机器上做需要显式推理的小题，或做 R1 系列的行为测试。',
    install: {
      cmd: 'ollama pull deepseek-r1:1.5b\nollama run deepseek-r1:1.5b',
      verify: '问一道逻辑题，应该看到 <think> 形式的思考过程再出答案。',
      tune: '体积才 1.1GB，可以常驻内存不卸载，当「秒开推理器」用。'
    },
    api: null,
    pitfalls: ['1.5B 参数决定了它推理深度有限，复杂题会绕不出来。'],
    updated: '2026-09-11'
  },
  {
    id: 'deepseek-r1-8b',
    name: 'deepseek-r1:8b',
    vendor: 'DeepSeek',
    kind: 'local',
    tier: 'free',
    status: 'verified',
    tags: ['reasoning', 'coding'],
    hw: ['t8', 't12', 't16'],
    vram: '5.0GB（Q4_K_M）',
    ctx: '64K',
    license: 'MIT',
    price: '免费',
    oneLiner: '8GB 显存档的推理主力，思维链质量明显强过 1.5B。',
    bestFor: '数学题、逻辑推导、需要「把过程写出来」的任务。',
    install: {
      cmd: 'ollama pull deepseek-r1:8b\nollama run deepseek-r1:8b',
      verify: '让它解一道需要列方程的应用题，检查推导是否自洽。',
      tune: '思考过程会吃掉大量 token，num-predict 至少给到 2048 才不会截断。'
    },
    api: null,
    pitfalls: ['输出慢（要先把思考写完），交互式聊天别用它。'],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-omni-30b',
    name: 'qwen3-omni:30b',
    vendor: '阿里 通义千问',
    kind: 'local',
    tier: 'free',
    status: 'community',
    tags: ['vision', 'chat', 'audio'],
    hw: ['t24', 't32'],
    vram: '19GB',
    ctx: '32K',
    license: 'Apache 2.0',
    price: '免费',
    oneLiner: '文本 / 图像 / 音频 / 视频全模态一个模型搞定，本地 Omni 方案。',
    bestFor: '既要看图又要听音的任务：视频内容理解、会议录音 + 画面联合分析。',
    install: {
      cmd: 'ollama pull qwen3-omni:30b\nollama run qwen3-omni:30b',
      verify: '同时给一张图 + 一段描述，看它能否把两者关联起来回答。',
      tune: '音视频输入会额外吃显存，24GB 卡建议先把 num-ctx 压到 8192。'
    },
    api: null,
    pitfalls: ['19GB 起步，16GB 卡上会大量卸载到 CPU，速度掉到不可用。'],
    updated: '2026-09-11'
  },
  {
    id: 'gemma4-31b',
    name: 'gemma4:31b',
    vendor: 'Google DeepMind',
    kind: 'local',
    tier: 'free',
    status: 'community',
    tags: ['chat', 'vision'],
    hw: ['t32'],
    vram: '24GB',
    ctx: '131K',
    license: 'Gemma 许可',
    price: '免费',
    oneLiner: '32-48GB 档的多模态选择，QAT 量化版效率好。',
    bestFor: '大内存机器做图文混合任务。',
    install: { cmd: 'ollama pull gemma4:31b\nollama run gemma4:31b', verify: '图文混合问答。', tune: '' },
    api: null,
    pitfalls: ['Apple Silicon 上 2026-07 MLX 更新后提速约 90%，Mac 用户可优先。'],
    updated: '2026-09-11'
  },
  {
    id: 'glm-5-3-flash',
    name: 'GLM-5.3-Flash',
    vendor: 'Z.ai（智谱）',
    kind: 'local',
    tier: 'free',
    status: 'untested',
    tags: ['coding', 'agent'],
    hw: ['tserver'],
    vram: '约 320B 总权重，需 384GB 级部署',
    ctx: '1.048M',
    license: 'MIT',
    price: '免费',
    oneLiner: '1M 上下文 + MIT 许可的 MoE 编码强者，但体积是服务器级的。',
    bestFor: '多卡工作站；个人用户建议改用 NVIDIA NIM 免费 API 调同一个模型，别自己扛。',
    install: {
      cmd: '# 个人机器不建议本地部署，改用免费 API：\n# NVIDIA NIM 提供 z-ai/glm5.2 等 GLM 系列免费端点',
      verify: '如坚持本地部署：需 384GB 级显存/内存，官方 FP8 部署档。',
      tune: ''
    },
    api: null,
    pitfalls: [
      '总权重 320B，即使 MoE 只激活 18B，权重体积也下不来——「激活小」不等于「装得下」。',
      '本站未实测，欢迎在实验室补充你的部署经验。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    vendor: 'DeepSeek',
    kind: 'local',
    tier: 'free',
    status: 'untested',
    tags: ['coding', 'reasoning', 'vision'],
    hw: ['tserver'],
    vram: '305B 总权重 / 13B 激活',
    ctx: '1M',
    license: 'MIT',
    price: '免费',
    oneLiner: 'MIT 许可、1M 上下文、带视觉编码器的 MoE，服务器级性价比之选。',
    bestFor: '多卡服务器；个人用走 NVIDIA NIM 免费端点更实际。',
    install: { cmd: '# 个人推荐走免费 API：NVIDIA NIM 上有 DeepSeek V4 Flash 端点', verify: '', tune: '' },
    api: null,
    pitfalls: ['本站未实测本地部署，欢迎留言补充。'],
    updated: '2026-09-11'
  },

  /* ===== 云端 API ===== */
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM（免费 API）',
    vendor: 'NVIDIA',
    kind: 'api',
    tier: 'free',
    status: 'verified',
    tags: ['coding', 'agent', 'chat', 'longctx'],
    hw: [],
    vram: '无需本地算力',
    ctx: '最高 1M（视模型）',
    license: '—',
    price: '免费：40 RPM，无 token 上限',
    oneLiner: '目前最值得锁定的免费 API：永久免费、不看额度只看速率、82+ 开源模型。',
    bestFor: '零成本调用 GLM-5.2 / DeepSeek V4 / Kimi K2.6 / gpt-oss-120b 等顶级开源模型。',
    install: null,
    api: {
      signup: '打开 build.nvidia.com，用邮箱注册（需手机号验证，不需要信用卡）',
      key: '选一个模型 → 右上角 Get API Key → 复制（nvapi- 开头）',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      modelId: 'z-ai/glm5.2（当前免费榜首）、deepseek-ai/deepseek-v4-flash、moonshotai/kimi-k2.6 等',
      curl: 'curl https://integrate.api.nvidia.com/v1/chat/completions \\\n  -H "Authorization: Bearer $NVIDIA_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"z-ai/glm5.2","messages":[{"role":"user","content":"你好"}],"max_tokens":512}\'',
      compat: '完全兼容 OpenAI 格式——代码里只改 base_url 和 api_key 即可'
    },
    pitfalls: [
      '40 RPM 上限且不可提升，agent 的连续工具调用很容易触发 429。',
      '免费层条款允许 NVIDIA 用你的输入输出改进模型——敏感数据、客户代码别走这条路。',
      '手机验证是硬门槛，国内号码通常可过。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'gemini-ai-studio',
    name: 'Google AI Studio（免费 API）',
    vendor: 'Google',
    kind: 'api',
    tier: 'free',
    status: 'verified',
    tags: ['longctx', 'vision', 'chat'],
    hw: [],
    vram: '无需本地算力',
    ctx: '1,048,576 tokens（Flash 系）',
    license: '—',
    price: '免费：约 1500 请求/日，15 RPM',
    oneLiner: '免费档给 1M 上下文 + 每天 1500 次，长文档和多模态的最划算解。',
    bestFor: '整本书分析、视频/音频理解、PDF 问答。',
    install: null,
    api: {
      signup: '打开 aistudio.google.com，用 Google 账号登录（不要信用卡）',
      key: 'Get API Key → Create API key → 复制（AIza 开头）',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      modelId: 'gemini-3.6-flash（免费旗舰）、gemini-3.5-flash-lite、gemini-3.1-flash-lite',
      curl: 'curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=$GOOGLE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"contents":[{"parts":[{"text":"总结一下这份文档"}]}]}\'',
      compat: '不兼容 OpenAI 格式，需用官方 SDK 或自行适配；也可走 OpenAI 兼容网关'
    },
    pitfalls: [
      'Pro 系列（2.5 Pro / 3.1 Pro）自 2026-04-01 起已移除免费层，只剩 Flash 系。',
      'EEA/UK/瑞士以外地区的数据可能被用于训练，敏感内容谨慎。',
      'Google 有前科：免费额度曾无预警削减，别把生产系统押在这一个源上。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'groq',
    name: 'Groq（免费 API）',
    vendor: 'Groq',
    kind: 'api',
    tier: 'free',
    status: 'verified',
    tags: ['chat', 'coding'],
    hw: [],
    vram: '无需本地算力',
    ctx: '131K',
    license: '—',
    price: '免费：约 1000 请求/日（按模型）',
    oneLiner: '300-3000+ tok/s 的极致速度，LPU 芯片给你的免费体验装。',
    bestFor: '需要极低延迟的场景：实时对话、流式输出演示。',
    install: null,
    api: {
      signup: 'console.groq.com 注册（邮箱即可，不需要卡）',
      key: 'API Keys → Create API Key',
      baseUrl: 'https://api.groq.com/openai/v1',
      modelId: 'openai/gpt-oss-120b、qwen3.8:27b（Groq 上架标签以控制台为准）、llama-4-scout',
      curl: 'curl https://api.groq.com/openai/v1/chat/completions \\\n  -H "Authorization: Bearer $GROQ_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"openai/gpt-oss-120b","messages":[{"role":"user","content":"你好"}]}\'',
      compat: '兼容 OpenAI 格式'
    },
    pitfalls: ['每个模型有独立的 RPD 上限，换模型前先查控制台配额。'],
    updated: '2026-09-11'
  },
  {
    id: 'ollama-cloud',
    name: 'Ollama Cloud（免费层）',
    vendor: 'Ollama',
    kind: 'api',
    tier: 'free',
    status: 'community',
    tags: ['coding', 'agent'],
    hw: [],
    vram: '无需本地算力',
    ctx: '视模型',
    license: '—',
    price: '免费层（限额未公开）',
    oneLiner: '不用本地 GPU 也能跑 kimi-k3、deepseek-v4-pro 这类顶级模型。',
    bestFor: '本地跑不动、又想用开源顶配的过渡方案。',
    install: null,
    api: {
      signup: 'ollama.com 注册账号，本地 ollama 登录',
      key: 'ollama signin → 用账户凭证',
      baseUrl: 'Ollama Cloud 端点（跟随官方客户端）',
      modelId: 'kimi-k3、deepseek-v4-flash、deepseek-v4-pro、minimax-m3',
      curl: '# 通过本地 ollama 客户端连云\nollama run kimi-k3',
      compat: 'Ollama 原生协议 + OpenAI 兼容端点'
    },
    pitfalls: ['官方未公布限额数值，属「周级/会话级限制且不可预期」，不适合生产环境。'],
    updated: '2026-09-11'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter（免费模型聚合）',
    vendor: 'OpenRouter',
    kind: 'api',
    tier: 'freemium',
    status: 'verified',
    tags: ['chat', 'coding', 'agent'],
    hw: [],
    vram: '无需本地算力',
    ctx: '最高 1M',
    license: '—',
    price: '免费模型约 50 请求/日；付费按量',
    oneLiner: '一个 key 打通 35+ 免费模型和所有付费旗舰。',
    bestFor: '想在一个地方对比多家模型、或做模型路由。',
    install: null,
    api: {
      signup: 'openrouter.ai 注册',
      key: 'Keys → Create Key（sk-or- 开头）',
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: '在模型名后加 :free 走免费档，如 deepseek/deepseek-v4-flash:free',
      curl: 'curl https://openrouter.ai/api/v1/chat/completions \\\n  -H "Authorization: Bearer $OPENROUTER_API_KEY" \\\n  -d \'{"model":"deepseek/deepseek-v4-flash:free","messages":[{"role":"user","content":"你好"}]}\'',
      compat: '完全兼容 OpenAI 格式'
    },
    pitfalls: ['免费模型轮换频繁，今天能用的 ID 下周可能下线，代码里要容错。'],
    updated: '2026-09-11'
  },
  {
    id: 'github-models',
    name: 'GitHub Models（免费）',
    vendor: 'GitHub / Microsoft',
    kind: 'api',
    tier: 'free',
    status: 'community',
    tags: ['chat', 'coding'],
    hw: [],
    vram: '无需本地算力',
    ctx: '视模型',
    license: '—',
    price: '免费（与 Copilot 档位挂钩）',
    oneLiner: '有 GitHub 账号就能免费调 GPT-5 / Grok 3 等旗舰，无需独立 key。',
    bestFor: '开发者零成本试用旗舰模型做原型验证。',
    install: null,
    api: {
      signup: 'github.com/marketplace/models，用 GitHub 账号登录',
      key: '用 GitHub PAT（Personal Access Token）作为 API key',
      baseUrl: 'https://models.github.ai/inference（或 models.inference.ai.azure.com）',
      modelId: 'openai/gpt-5、xai/grok-3 等（以目录为准）',
      curl: 'curl https://models.github.ai/inference/chat/completions \\\n  -H "Authorization: Bearer $GITHUB_TOKEN" \\\n  -d \'{"model":"openai/gpt-5","messages":[{"role":"user","content":"你好"}]}\'',
      compat: '兼容 OpenAI 格式'
    },
    pitfalls: ['额度与个人 Copilot 档位绑定，无独立配额，不适合团队共用。'],
    updated: '2026-09-11'
  },
  {
    id: 'gpt6-astra',
    name: 'GPT-6 Astra',
    vendor: 'OpenAI',
    kind: 'api',
    tier: 'paid',
    status: 'verified',
    tags: ['coding', 'agent', 'reasoning', 'vision'],
    hw: [],
    vram: '无需本地算力',
    ctx: '大上下文（官方未明确公开上限）',
    license: '商业 API',
    price: '$10 / 百万输入 token，$50 / 百万输出 token（缓存输入 $1）',
    oneLiner: '2026-09-03 发布的新一代旗舰，OpenAI 自称「全球最智能、对齐最好」的模型。',
    bestFor: '预算充足的极限任务：软件工程、科学研究、复杂 agent、计算机操作。',
    install: null,
    api: {
      signup: 'platform.openai.com 注册并绑定支付方式',
      key: 'API Keys → Create new secret key（sk- 开头）',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-6-astra（另有 Astra Pro 供 Pro/Business/Enterprise）',
      curl: 'curl https://api.openai.com/v1/responses \\\n  -H "Authorization: Bearer $OPENAI_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"gpt-6-astra","input":"帮我重构这个函数"}\'',
      compat: 'Responses API / Chat Completions；需注意新版用 Responses API'
    },
    pitfalls: [
      '价格是 GPT-5.6 Sol 促销价的 2.5 倍（$10/$50 vs $4/$20）。',
      '最强网络安全能力未全面开放；企业版默认关闭访问，需管理员开启。',
      '国内直连通常需要代理，且需合规使用。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'gpt56-sol',
    name: 'GPT-5.6 Sol',
    vendor: 'OpenAI',
    kind: 'api',
    tier: 'paid',
    status: 'verified',
    tags: ['coding', 'agent', 'vision'],
    hw: [],
    vram: '无需本地算力',
    ctx: '大上下文',
    license: '商业 API',
    price: '$4 / $20 每百万 token（促销价，至少持续到 2026-11-21）',
    oneLiner: 'GPT-6 发布前的旗舰，促销价下性价比反超新款。',
    bestFor: '想要接近顶配能力但预算敏感的编码/agent 任务。',
    install: null,
    api: {
      signup: 'platform.openai.com',
      key: 'API Keys',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-5.6-sol（另有 terra 均衡档、luna 低价档）',
      curl: 'curl https://api.openai.com/v1/responses \\\n  -H "Authorization: Bearer $OPENAI_API_KEY" \\\n  -d \'{"model":"gpt-5.6-sol","input":"写个快速排序"}\'',
      compat: 'Responses API；支持 max / ultra 推理档（ultra 默认并行 4 个 agent）'
    },
    pitfalls: [
      '促销价 2026-11-21 后可能回调到 $5/$30，做成本预算要留余量。',
      '已退役型号：GPT-4o / GPT-4.1 / o4-mini / GPT-5（2026-02-13）、GPT-5.1（3-11），别再写进新代码。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'gpt56-terra',
    name: 'GPT-5.6 Terra / Luna',
    vendor: 'OpenAI',
    kind: 'api',
    tier: 'paid',
    status: 'verified',
    tags: ['chat', 'coding'],
    hw: [],
    vram: '无需本地算力',
    ctx: '大上下文',
    license: '商业 API',
    price: 'Terra $2 / $12；Luna $0.20 / $1.20 每百万 token',
    oneLiner: '日常档（Terra）与极致低价档（Luna），Luna 便宜到可以随便用。',
    bestFor: '大批量日常任务、分类、抽取、后台 agent 自动化。',
    install: null,
    api: {
      signup: 'platform.openai.com',
      key: 'API Keys',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-5.6-terra / gpt-5.6-luna',
      curl: 'curl https://api.openai.com/v1/responses \\\n  -H "Authorization: Bearer $OPENAI_API_KEY" \\\n  -d \'{"model":"gpt-5.6-luna","input":"把这段文本分类"}\'',
      compat: 'Responses API'
    },
    pitfalls: ['ChatGPT 免费用户默认用的就是 Luna——如果只是聊天，可能根本不需要付费。'],
    updated: '2026-09-11'
  },
  {
    id: 'claude-fable-5-1',
    name: 'Claude Fable 5.1',
    vendor: 'Anthropic',
    kind: 'api',
    tier: 'paid',
    status: 'verified',
    tags: ['agent', 'coding', 'reasoning'],
    hw: [],
    vram: '无需本地算力',
    ctx: '1M tokens',
    license: '商业 API',
    price: '$10 / 百万输入，$50 / 百万输出',
    oneLiner: 'Anthropic 公开模型里的最高能力档，专为长程 agent 设计。',
    bestFor: '失败成本极高的长链路任务：仓库级重构、复杂工具调用、长时研究。',
    install: null,
    api: {
      signup: 'console.anthropic.com 注册（需绑卡）',
      key: 'Settings → API Keys → Create Key（sk-ant- 开头）',
      baseUrl: 'https://api.anthropic.com',
      modelId: 'claude-fable-5-1',
      curl: 'curl https://api.anthropic.com/v1/messages \\\n  -H "x-api-key: $ANTHROPIC_API_KEY" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -H "content-type: application/json" \\\n  -d \'{"model":"claude-fable-5-1","max_tokens":1024,"messages":[{"role":"user","content":"你好"}]}\'',
      compat: 'Anthropic Messages API（也支持 AWS Bedrock / Vertex AI / Azure AI Foundry）'
    },
    pitfalls: [
      '必须接受 30 天数据保留，不提供零数据留存（ZDR）方案——合规敏感场景直接出局。',
      '增强的安全分类器会误伤正常编程/调试请求，官方承认假阳性上升。',
      'Mythos 5/5.1 是受限的防御性网络安全模型，普通账号申请不到。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    vendor: 'Anthropic',
    kind: 'api',
    tier: 'paid',
    status: 'verified',
    tags: ['coding', 'agent', 'vision'],
    hw: [],
    vram: '无需本地算力',
    ctx: '1M tokens',
    license: '商业 API',
    price: '$5 / 百万输入，$25 / 百万输出',
    oneLiner: '2026-07-24 发布，复杂 agent 编码和专业工作的主力旗舰。',
    bestFor: '日常专业工作的最强档，价格只有 Fable 的一半。',
    install: null,
    api: {
      signup: 'console.anthropic.com',
      key: 'Settings → API Keys',
      baseUrl: 'https://api.anthropic.com',
      modelId: 'claude-opus-5',
      curl: 'curl https://api.anthropic.com/v1/messages \\\n  -H "x-api-key: $ANTHROPIC_API_KEY" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -H "content-type: application/json" \\\n  -d \'{"model":"claude-opus-5","max_tokens":1024,"messages":[{"role":"user","content":"你好"}]}\'',
      compat: 'Messages API；也可走 Bedrock / Vertex / Azure'
    },
    pitfalls: ['知识截止 2026-05，更新的事实需要联网检索。'],
    updated: '2026-09-11'
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    vendor: 'Anthropic',
    kind: 'api',
    tier: 'paid',
    status: 'verified',
    tags: ['chat', 'coding', 'vision'],
    hw: [],
    vram: '无需本地算力',
    ctx: '1M tokens',
    license: '商业 API',
    price: '$3 / $15 每百万 token（促销期 $2/$10，至 2026-08-31）',
    oneLiner: '速度与智能的最佳平衡点，多数场景的实际首选。',
    bestFor: '不想纠结就选它——能力接近 Opus，价格低 40%。',
    install: null,
    api: {
      signup: 'console.anthropic.com',
      key: 'Settings → API Keys',
      baseUrl: 'https://api.anthropic.com',
      modelId: 'claude-sonnet-5',
      curl: 'curl https://api.anthropic.com/v1/messages \\\n  -H "x-api-key: $ANTHROPIC_API_KEY" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -H "content-type: application/json" \\\n  -d \'{"model":"claude-sonnet-5","max_tokens":1024,"messages":[{"role":"user","content":"你好"}]}\'',
      compat: 'Messages API'
    },
    pitfalls: ['促销价已过期，按 $3/$15 做预算。'],
    updated: '2026-09-11'
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    vendor: 'Anthropic',
    kind: 'api',
    tier: 'paid',
    status: 'verified',
    tags: ['chat', 'coding'],
    hw: [],
    vram: '无需本地算力',
    ctx: '200K tokens',
    license: '商业 API',
    price: '$1 / $5 每百万 token',
    oneLiner: '最便宜最快的 Claude，适合高并发和子任务。',
    bestFor: '分类、抽取、大批量轻度任务；在多模型架构里做「小工」。',
    install: null,
    api: {
      signup: 'console.anthropic.com',
      key: 'Settings → API Keys',
      baseUrl: 'https://api.anthropic.com',
      modelId: 'claude-haiku-4-5-20251001',
      curl: 'curl https://api.anthropic.com/v1/messages \\\n  -H "x-api-key: $ANTHROPIC_API_KEY" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -H "content-type: application/json" \\\n  -d \'{"model":"claude-haiku-4-5-20251001","max_tokens":1024,"messages":[{"role":"user","content":"你好"}]}\'',
      compat: 'Messages API'
    },
    pitfalls: ['200K 上下文，比 Opus/Sonnet 的 1M 小很多，长文档别用它。'],
    updated: '2026-09-11'
  },
  {
    id: 'deepseek-official',
    name: 'DeepSeek 官方 API',
    vendor: 'DeepSeek',
    kind: 'api',
    tier: 'paid',
    status: 'community',
    tags: ['coding', 'reasoning', 'chat'],
    hw: [],
    vram: '无需本地算力',
    ctx: '128K-1M（视模型）',
    license: '商业 API',
    price: '低价档（国内最具性价比之一）',
    oneLiner: '国内直连、OpenAI 兼容、价格低，代码+推理的性价比之选。',
    bestFor: '不想折腾代理又要不错能力的国内开发者。',
    install: null,
    api: {
      signup: 'platform.deepseek.com 注册',
      key: 'API Keys → 创建',
      baseUrl: 'https://api.deepseek.com',
      modelId: 'deepseek-chat / deepseek-reasoner（以控制台为准）',
      curl: 'curl https://api.deepseek.com/chat/completions \\\n  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"deepseek-chat","messages":[{"role":"user","content":"你好"}]}\'',
      compat: '完全兼容 OpenAI 格式'
    },
    pitfalls: ['免费额度与速率政策调整频繁，以官方控制台实时信息为准。'],
    updated: '2026-09-11'
  },
  {
    id: 'llama-4-maverick',
    name: 'Llama 4 Maverick',
    vendor: 'Meta（开源权重）',
    kind: 'api',
    tier: 'freemium',
    status: 'community',
    tags: ['chat', 'vision', 'coding'],
    hw: ['tserver'],
    vram: '',
    ctx: '1M',
    license: 'Llama 4 许可',
    price: '免费额度（Groq / NIM）· 付费约 $0.15/M',
    oneLiner: '开源 MoE 里的多模态代表，1M 上下文 + 原生视觉，走 Groq 几乎白嫖。',
    bestFor: '要开源可迁移、又要长上下文 + 看图能力的项目。',
    install: null,
    api: {
      signup: 'Groq（console.groq.com）或 NVIDIA NIM（build.nvidia.com）注册即可，无需信用卡。',
      key: 'Groq 控制台 → API Keys → Create Key（gsk_ 开头）。',
      baseUrl: 'https://api.groq.com/openai/v1',
      modelId: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      curl: 'curl https://api.groq.com/openai/v1/chat/completions \\\n  -H "Authorization: Bearer $GROQ_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"meta-llama/llama-4-maverick-17b-128e-instruct","messages":[{"role":"user","content":"你好"}]}\'',
      compat: 'OpenAI 兼容'
    },
    pitfalls: ['各家托管的模型 ID 不一致，务必以所用平台的「模型代码」列为准，别抄显示名。'],
    updated: '2026-09-11'
  },
  {
    id: 'qwen3-8-flash-next',
    name: 'Qwen3.8 Flash Next',
    vendor: '阿里 通义千问',
    kind: 'api',
    tier: 'freemium',
    status: 'community',
    tags: ['chat', 'coding', 'longctx'],
    hw: ['tserver'],
    vram: '',
    ctx: '1M',
    license: 'Apache 2.0',
    price: '按量计费，Flash 档极便宜',
    oneLiner: '128GB 级 MoE，激活参数小所以便宜又快，中文场景性价比最高的云端档。',
    bestFor: '中文长文档处理、批量调用、对成本敏感的线上服务。',
    install: null,
    api: {
      signup: '阿里云百炼（bailian.console.aliyun.com）开通 DashScope。',
      key: '百炼控制台 → API-KEY 管理 → 创建（sk- 开头）。',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      modelId: 'qwen3.8-flash-next（以控制台模型列表为准）',
      curl: 'curl https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \\\n  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"qwen3.8-flash-next","messages":[{"role":"user","content":"你好"}]}\'',
      compat: 'OpenAI 兼容'
    },
    pitfalls: ['模型代号迭代快（Flash / Flash Next / Plus 容易混），填之前先在控制台确认当前代号。'],
    updated: '2026-09-11'
  },
  {
    id: 'kimi-k3',
    name: 'Kimi K3',
    vendor: 'Moonshot AI（月之暗面）',
    kind: 'api',
    tier: 'paid',
    status: 'community',
    tags: ['agent', 'coding', 'longctx'],
    hw: ['tserver'],
    vram: '',
    ctx: '1M',
    license: '开源权重（Modified MIT）',
    price: '按量计费，输出约 $15/M',
    oneLiner: '全球最大开源模型（约 2.8T 参数 MoE），Arena Code Elo 全球第二。',
    bestFor: '长程 Agent、超大代码库理解、需要「不迷路」的多步任务。',
    install: null,
    api: {
      signup: 'Moonshot 开放平台（platform.moonshot.cn）注册并实名。',
      key: '控制台 → API Key 管理 → 新建（sk- 开头）。',
      baseUrl: 'https://api.moonshot.cn/v1',
      modelId: 'kimi-k3（以控制台模型列表为准）',
      curl: 'curl https://api.moonshot.cn/v1/chat/completions \\\n  -H "Authorization: Bearer $MOONSHOT_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"kimi-k3","messages":[{"role":"user","content":"你好"}]}\'',
      compat: 'OpenAI 兼容'
    },
    pitfalls: [
      'Kimi 消费者端 App 与开放平台是两套账号，App 里拿不到 API Key。',
      '权重体积巨大，本地自部署基本不现实，走 API。'
    ],
    updated: '2026-09-11'
  },
  {
    id: 'minimax-m3',
    name: 'MiniMax-M3',
    vendor: 'MiniMax（稀宇）',
    kind: 'api',
    tier: 'freemium',
    status: 'community',
    tags: ['agent', 'coding', 'chat'],
    hw: ['tserver'],
    vram: '',
    ctx: '1M',
    license: '开源权重',
    price: '有免费额度，按量计费',
    oneLiner: '国产开源 MoE 里的 Agent 强手，工具调用稳定、长链路不跑偏。',
    bestFor: 'Agent 工作流、自动化脚本编排、需要频繁调工具的场景。',
    install: null,
    api: {
      signup: 'MiniMax 开放平台（platform.minimaxi.com）注册。',
      key: '账户管理 → 接口密钥 → 创建新的密钥。',
      baseUrl: 'https://api.minimaxi.com/v1',
      modelId: 'MiniMax-M3（以控制台模型列表为准）',
      curl: 'curl https://api.minimaxi.com/v1/chat/completions \\\n  -H "Authorization: Bearer $MINIMAX_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"MiniMax-M3","messages":[{"role":"user","content":"你好"}]}\'',
      compat: 'OpenAI 兼容'
    },
    pitfalls: ['模型名大小写敏感，MiniMax-M3 与 minimax-m3 在不同平台要求不同，以文档为准。'],
    updated: '2026-09-11'
  }
];

/* ---------- 通用教程：从零到跑通（给完全不懂的人） ---------- */
const BASICS = [
  {
    id: 'b1',
    title: '第 1 步：装 Ollama（本地模型的唯一入口）',
    body: 'Ollama 把「下载模型 + 加载 + 开 API 服务」三件事合成一条命令。Windows / macOS 去 ollama.com 下载安装包双击即可，Linux 用 curl -fsSL https://ollama.com/install.sh | sh。\n装完在终端输入 ollama --version，能出版本号就成了。',
    cmd: 'ollama --version'
  },
  {
    id: 'b2',
    title: '第 2 步：先把模型目录挪出 C 盘（90% 的人踩这个坑）',
    body: '模型默认存在 C 盘，一个 14B 就是 9GB，几个模型就把系统盘撑爆。装完第一件事：设置环境变量 OLLAMA_MODELS 指向你的大容量盘（比如 J:\\ollama-models），然后重启 Ollama。',
    cmd: '# Windows PowerShell（管理员）\nsetx OLLAMA_MODELS "J:\\ollama-models" /M\n# 重启 Ollama 后生效'
  },
  {
    id: 'b3',
    title: '第 3 步：拉模型并跑通第一句话',
    body: 'pull 是下载，run 是下载+进入对话。第一次 run 会自动 pull，之后直接用 run 即可。跑起来后随便问一句，能出字就说明链路通了。',
    cmd: 'ollama run qwen3:14b\n>>> 用一句话解释什么是向量数据库'
  },
  {
    id: 'b4',
    title: '第 4 步：让它变成一个 API（这样所有软件都能用）',
    body: 'Ollama 默认已经在 localhost:11434 开了 OpenAI 兼容的 API。这意味着任何支持 OpenAI 的软件，只要把 base_url 改成它、api_key 随便填，就能用你的本地模型——不花一分钱、数据不出本机。',
    cmd: 'from openai import OpenAI\nclient = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")\nr = client.chat.completions.create(\n    model="qwen3:14b",\n    messages=[{"role":"user","content":"你好"}]\n)\nprint(r.choices[0].message.content)'
  },
  {
    id: 'b5',
    title: '第 5 步：接到日常软件里',
    body: '推荐三个现成客户端，都不用写代码：\n• Cherry Studio / ChatBox —— 聊天客户端，填 base_url + 模型名即可，本地和云端模型统一管理。\n• Continue / Cline —— 写代码用，VS Code 插件，接本地模型做补全和 agent。\n• ComfyUI —— 做图/视频工作流里需要文本理解时，可接本地 LLM。\n填法都一样：provider 选 OpenAI 兼容，base_url 填 http://localhost:11434/v1，key 填 ollama。',
    cmd: ''
  },
  {
    id: 'b6',
    title: '第 6 步：判断「我的电脑到底能跑多大」',
    body: '经验公式：Q4 量化下，模型体积(GB) ≈ 参数量(B) × 0.6。\n再加 1-2GB 给上下文和缓存。\n所以：8B ≈ 5GB、14B ≈ 9GB、27B ≈ 16-18GB、32B ≈ 20GB。\n最关键的一条：模型必须能 100% 装进显存。一旦超出触发 CPU 卸载，速度会掉 3-10 倍——16GB 卡上跑 20B(13GB) 是 139 tok/s，跑 120B(66GB) 只剩 12 tok/s。宁可小一号，不要卸载。',
    cmd: '# 实时看显存占用\nnvidia-smi -l 1'
  }
];

/* ---------- 实验室工单状态 ---------- */
const TICKET_STATUS = {
  open: { label: '待验证', color: '#f0a020', desc: '已收到，还没测' },
  testing: { label: '测试中', color: '#4a9eff', desc: '站长正在实机验证' },
  resolved: { label: '已验证', color: '#30c85e', desc: '已实测并给出结论' },
  ignored: { label: '不采纳', color: '#8b8b8b', desc: '暂不处理或超出范围' }
};

/* ============================================================
 * 全球大模型 Top 50 排行榜
 * 排序方法：以 airankings（7 家独立榜单「奖牌榜」聚合，Sep 9 2026）为基准，
 *           交叉校验 llm-stats 综合指数（Sep 9 2026）与 BenchLM BenchAlign v5.2（Sep 3 2026）。
 * score 为归一化后的本站综合分（满分 100），仅用于横向对比，非任何官方分数。
 * 字段：pros=优势 / best=最适合做什么 / avoid=别拿它做什么
 * ============================================================ */
const TOP50 = [
  {
    rank: 1, name: 'GPT-6 Astra', vendor: 'OpenAI', accent: '#6b8afd',
    score: 98.9, scoreNote: 'llm-stats 综合指数 60.3（第 1）· llmboard 98.89（第 1）',
    ctx: '1M', price: '付费 · 高端档', open: false, modality: '文本 / 图像 / 视频',
    pros: ['推理能力断层第一，llmboard 推理榜拿满分档', '综合指数领先第二名 4 分，各分项无短板', '长上下文 + 工具调用 + 多模态全线拉满'],
    best: '要「一次做对」的硬任务：复杂推理、竞赛数学、跨领域综合分析。预算不是第一约束时的默认选择。',
    avoid: '高并发批量调用——价格是这一档里最贵的，日常简单问答用它属于浪费。',
    linkTo: 'gpt6-astra'
  },
  {
    rank: 2, name: 'Claude Fable 5.1', vendor: 'Anthropic', accent: '#a78bfa',
    score: 96.4, scoreNote: 'BenchLM 82.58（第 1）· llm-stats 第 2 · Artificial Analysis 第 1',
    ctx: '1M', price: '付费 · 高端档', open: false, modality: '文本 / 图像',
    pros: ['长程 Agent 表现公认第一，几十步链路不迷路', '三个独立榜单同时进前二，稳定性最好', '指令遵循极其严格，格式输出几乎不会跑偏'],
    best: '长链路自动化：多步调研、连续代码重构、需要「跑几小时也不跑偏」的 Agent 任务。',
    avoid: '追求极致低价——它是顶配价，简单任务用 Sonnet 5 或 Terra 更划算。',
    linkTo: 'claude-fable-5-1'
  },
  {
    rank: 3, name: 'Claude Opus 5', vendor: 'Anthropic', accent: '#a78bfa',
    score: 95.8, scoreNote: 'Arena Code Elo 1711.88（全球第一）· BenchLM 82.13（第 3）',
    ctx: '500K', price: '付费 · 高端档', open: false, modality: '文本 / 图像',
    pros: ['编码能力全球第一，Arena Code Elo 断层领先', '大型代码库理解与跨文件重构最稳', '写作质感自然，少有「AI 味」'],
    best: '严肃的软件工程：大型仓库重构、疑难 bug 定位、需要改动几十个文件的任务。',
    avoid: '纯聊天闲聊、批量短文本处理——杀鸡用牛刀。',
    linkTo: 'claude-opus-5'
  },
  {
    rank: 4, name: 'GPT-5.6 Sol', vendor: 'OpenAI', accent: '#6b8afd',
    score: 94.6, scoreNote: 'llm-stats 55.1（第 3）· BenchLM 81.78（第 5）',
    ctx: '1M', price: '付费 · 中高端', open: false, modality: '文本 / 图像',
    pros: ['综合分紧咬第一梯队，价格比 Astra 低一档', '响应速度明显快于 Astra，交互式体验好', '工具调用成功率高，适合做线上服务引擎'],
    best: '生产环境的通用引擎——要接近顶配的智能，又要能扛并发和延迟。',
    avoid: '极限推理题（那还是 Astra 的活）。',
    linkTo: 'gpt56-sol'
  },
  {
    rank: 5, name: 'Muse Spark 1.3', vendor: 'Meta', accent: '#34d3c4',
    score: 93.2, scoreNote: 'llm-stats 55.1（第 4）· llmboard 90.82（第 5）',
    ctx: '1M', price: '付费 · 中端', open: false, modality: '文本 / 图像',
    pros: ['Meta 当前旗舰，综合分挤进前五', '单位 token 成本远低于 OpenAI / Anthropic 同档', '创意写作与开放性生成评价突出'],
    best: '预算敏感又要旗舰级质量的项目：内容批量生成、营销文案、创意脑暴。',
    avoid: '需要严格格式 / 严谨推理的工程类任务。',
    linkTo: null
  },
  {
    rank: 6, name: 'Claude Fable 5', vendor: 'Anthropic', accent: '#a78bfa',
    score: 92.8, scoreNote: 'LMArena 第 1 · BenchLM 82.23（第 2）· llm-stats 54.5',
    ctx: '500K', price: '付费 · 高端档', open: false, modality: '文本 / 图像',
    pros: ['LMArena 盲测第一，人类偏好度最高', '对话自然度与「懂你没说出口的话」的能力最强', '长文档处理稳定'],
    best: '需要「读起来像人写的」的场景：对外文案、客户沟通、长篇报告润色。',
    avoid: '纯代码工程（让位给 Opus 5）。',
    linkTo: null
  },
  {
    rank: 7, name: 'Claude Mythos', vendor: 'Anthropic', accent: '#a78bfa',
    score: 92.1, scoreNote: 'llmboard Coding 98.82（第 1）· Knowledge 99.27（第 1）',
    ctx: '500K', price: '付费 · 高端档', open: false, modality: '文本 / 图像',
    pros: ['编码榜与知识榜双料第一', '事实性问答准确率极高，幻觉率低', '在安全 / 合规要求高的场景表现稳'],
    best: '知识密集型任务：专业领域问答、需要引用准确事实的报告、合规审查辅助。',
    avoid: '预算有限时的通用聊天。',
    linkTo: null
  },
  {
    rank: 8, name: 'Kimi K3', vendor: 'Moonshot AI（月之暗面）', accent: '#f5a524',
    score: 90.9, scoreNote: 'Arena Code Elo 1681.75（全球第二）· 保留 96% 顶配分、输出价低 70%',
    ctx: '1M', price: '付费 · 中端（输出约 $15/M）', open: true, modality: '文本',
    pros: ['全球最大开源模型（约 2.8T 参数 MoE）', '性价比之王：96% 的顶配能力、30% 的价格', '开源权重可自部署，国产第一梯队'],
    best: '既要强又要省：长程 Agent、超大代码库理解、需要自建部署的企业。',
    avoid: '多模态任务（K3 是纯文本）；超低延迟实时交互。',
    linkTo: 'kimi-k3'
  },
  {
    rank: 9, name: 'GLM-5.3', vendor: 'Z.ai（智谱）', accent: '#34d3c4',
    score: 89.4, scoreNote: 'llm-stats 53.4（第 8）· Artificial Analysis 第 7',
    ctx: '1M', price: '付费 · 中端', open: true, modality: '文本',
    pros: ['国产闭源 + 开源双线，综合分稳居前十', '1M 上下文，长文档处理能力强', '中文语境理解优于多数海外模型'],
    best: '中文长文档、政企场景、需要国产可控的方案。',
    avoid: '多模态（视觉要单独用 GLM-5V 系列）。',
    linkTo: null
  },
  {
    rank: 10, name: 'DeepSeek V4 Pro', vendor: 'DeepSeek', accent: '#6b8afd',
    score: 88.6, scoreNote: 'llm-stats 52.4（第 10）· DeepSeek-V4-Pro-0813',
    ctx: '1M', price: '付费 · 中端', open: true, modality: '文本',
    pros: ['开源权重，可自部署', '推理 / 数学能力在同价位里几乎没有对手', '1M 上下文 + 极低单价'],
    best: '数学与推理密集的批量任务、预算有限但要求硬能力的研发场景。',
    avoid: '需要多模态输入；对响应速度极端敏感的实时对话。',
    linkTo: null
  },
  {
    rank: 11, name: 'Qwen3.8 Max', vendor: '阿里巴巴', accent: '#f2685f',
    score: 87.9, scoreNote: 'Arena Code Elo 1667（全球第三 / 国产第二）',
    ctx: '1M', price: '付费 · 中端', open: false, modality: '文本 / 图像',
    pros: ['国产全能王，中文能力顶尖', '编码分全球第三，仅次于 Opus 5 与 Kimi K3', '阿里生态（百炼）接入最顺，国内延迟低'],
    best: '国内业务、中文内容生产、需要本地化支持与低延迟的线上服务。',
    avoid: '需要海外部署 / 英文创意写作的场景。',
    linkTo: null
  },
  {
    rank: 12, name: 'Hy4 preview', vendor: '腾讯混元', accent: '#34d3c4',
    score: 87.2, scoreNote: 'BenchLM 78.48 · 当前最佳开源权重模型 · Code Arena WebDev 第 6',
    ctx: '1M', price: '付费 · 中端（约 $1.67/M）', open: true, modality: '文本',
    pros: ['770B 总参 / 49B 激活，MoE 效率极高', '开源权重里评分最高，可自部署', 'WebDev 类任务排名快速上升（第 28 → 第 6）'],
    best: '想要「开源可自部署」又不想牺牲太多智能的团队；前端 / Web 开发任务。',
    avoid: '多模态；需要成熟稳定 SLA 的生产环境（preview 版仍在迭代）。',
    linkTo: null
  },
  {
    rank: 13, name: 'Gemini 3.8 Flash', vendor: 'Google', accent: '#f5a524',
    score: 86.5, scoreNote: 'airankings 第 10 · LMArena 第 4 · Vals.ai 第 3',
    ctx: '1M', price: '免费额度 + 付费', open: false, modality: '文本 / 图像 / 视频 / 音频',
    pros: ['原生全模态：图、视频、音频一个模型全吃', '1M 上下文，且免费档额度慷慨', 'Google 生态（AI Studio / Vertex）接入最省事'],
    best: '视频理解、超长多模态文档、需要免费额度起步的个人项目。',
    avoid: '纯文本推理（不如 DeepSeek / Astra）；国内直连需配代理。',
    linkTo: 'gemini-ai-studio'
  },
  {
    rank: 14, name: 'Claude Opus 4.8', vendor: 'Anthropic', accent: '#a78bfa',
    score: 85.7, scoreNote: 'LiveBench 第 1 · Vellum 第 5',
    ctx: '500K', price: '付费 · 高端档', open: false, modality: '文本 / 图像',
    pros: ['LiveBench 第一，抗污染评测表现最好', '长上下文下的信息检索准确', '稳定性经过长时间验证'],
    best: '需要抗「评测泄漏」的真实任务评测、长文档信息抽取。',
    avoid: '新项目优先考虑 Opus 5，性价比更好。',
    linkTo: null
  },
  {
    rank: 15, name: 'GLM-5.3 Flash', vendor: 'Z.ai（智谱）', accent: '#34d3c4',
    score: 84.9, scoreNote: '输入 $0.07/M · 1M 上下文 · Design Arena 第 4',
    ctx: '1M', price: '免费额度 + 付费（输入 $0.07/M）', open: true, modality: '文本',
    pros: ['1M 上下文里最便宜的一档，输入 $0.07/M', '有免费额度，个人项目几乎零成本起步', '中文指令遵循好，MIT 系许可友好'],
    best: '长文档批处理、Agent 循环调用、成本敏感的高频场景。',
    avoid: '看图（这是纯文本模型，视觉要 GLM-5V-Turbo）。',
    linkTo: 'glm-5-3-flash'
  },
  {
    rank: 16, name: 'GPT-5.6 Terra', vendor: 'OpenAI', accent: '#6b8afd',
    score: 84.1, scoreNote: '约 $0.035/task · LMArena 第 11',
    ctx: '400K', price: '付费 · 中低端', open: false, modality: '文本 / 图像',
    pros: ['OpenAI 系里单位成本最优的一档', '日常任务质量足够，速度快', '与 Sol / Astra 同 API，切换零成本'],
    best: '日常对话、批量摘要、分类打标这类「量大但不难」的任务。',
    avoid: '复杂推理、需要长链路规划的任务。',
    linkTo: 'gpt56-terra'
  },
  {
    rank: 17, name: 'Claude Sonnet 5', vendor: 'Anthropic', accent: '#a78bfa',
    score: 83.4, scoreNote: 'Vellum 第 6 · LiveBench 第 7',
    ctx: '500K', price: '付费 · 中端', open: false, modality: '文本 / 图像',
    pros: ['Anthropic 中端主力，质量/价格平衡点', '写作自然度接近 Fable 系', '响应快，适合交互式产品'],
    best: '面向用户的产品内嵌 AI：客服、写作助手、需要「文风好」的场景。',
    avoid: '极限编码（Opus 5）与极限省钱（Terra / Flash 系）。',
    linkTo: 'claude-sonnet-5'
  },
  {
    rank: 18, name: 'Grok 4.6', vendor: 'xAI', accent: '#f2685f',
    score: 82.6, scoreNote: 'Artificial Analysis 第 8',
    ctx: '2M', price: '付费 · 中端', open: false, modality: '文本 / 图像',
    pros: ['2M 上下文，是榜单里最长的之一', '实时信息获取能力强（X 平台数据）', '幽默 / 非主流风格任务有特色'],
    best: '需要最新时事信息、超长上下文（2M）、或个性化风格输出。',
    avoid: '严谨的事实性任务与合规场景。',
    linkTo: null
  },
  {
    rank: 19, name: 'DeepSeek V4 Flash', vendor: 'DeepSeek', accent: '#6b8afd',
    score: 81.8, scoreNote: 'OpenRouter 周榜第一 · 首周 7.1 万亿 token · 输出 $0.28/M',
    ctx: '1.3M', price: '付费 · 低价（输出 $0.28/M）', open: true, modality: '文本 / 图像',
    pros: ['OpenRouter 调用量周榜第一，社区验证最充分', '1.3M 上下文 + 原生视觉，Flash 档里少见', '价格极低，适合跑量'],
    best: '高频批量任务、个人项目主力模型、需要视觉又不想花大钱。',
    avoid: '需要最顶级推理质量的单次关键任务。',
    linkTo: 'deepseek-v4-flash'
  },
  {
    rank: 20, name: 'Gemini 3.7 Flash', vendor: 'Google', accent: '#f5a524',
    score: 80.9, scoreNote: 'LMArena 第 7 · Vals.ai 第 9 · Design Arena 第 8',
    ctx: '1M', price: '免费额度 + 付费', open: false, modality: '文本 / 图像 / 视频',
    pros: ['Flash 档里多模态最完整（含视频）', '免费额度 + 低价，入门零门槛', '设计与前端类任务评价好'],
    best: '多模态原型验证、设计稿理解、个人免费起步的 AI 应用。',
    avoid: '国内直连（需代理）；纯文本推理任务。',
    linkTo: null
  },
  {
    rank: 21, name: 'Llama 4 Maverick', vendor: 'Meta', accent: '#34d3c4',
    score: 80.2, scoreNote: '人工分析开源榜长期居首 · 1M 上下文',
    ctx: '1M', price: '开源权重 · 自部署免费', open: true, modality: '文本 / 图像',
    pros: ['Meta 开源旗舰，开源榜长期居首', '1M 上下文，多语言与长文档处理强', '本地部署生态最成熟，教程最多'],
    best: '想要「开源可自部署」又要接近闭源旗舰质量的团队；本地私有化部署首选。',
    avoid: '需要顶配推理 / 最新视频多模态的场景。',
    linkTo: null
  },
  {
    rank: 22, name: 'Qwen3-235B-A22B', vendor: '阿里巴巴', accent: '#f2685f',
    score: 79.5, scoreNote: '国产开源天花板 · MoE 仅激活 22B',
    ctx: '128K', price: '开源权重 · 阿里云低价', open: true, modality: '文本',
    pros: ['国产开源天花板，MoE 仅激活 22B 推理极快', '中英文均衡，代码与数学表现突出', '阿里云百炼部署最顺，国内延迟低'],
    best: '中文业务自部署、需要高吞吐的批量推理服务。',
    avoid: '超长上下文（仅 128K）；纯视觉任务。',
    linkTo: null
  },
  {
    rank: 23, name: 'DeepSeek V3.1', vendor: 'DeepSeek', accent: '#6b8afd',
    score: 78.9, scoreNote: '开源推理 / 数学第一梯队 · 671B MoE',
    ctx: '128K', price: '开源权重 · 输出约 $0.4/M', open: true, modality: '文本',
    pros: ['开源主力，推理 / 数学稳居开源第一梯队', '671B 总参 MoE，激活 37B 性价比极高', 'Ollama / vLLM 社区工具链支持最全'],
    best: '研发类推理、数学题、需要开源且硬核的任务。',
    avoid: '多模态；对延迟极端敏感的实时对话。',
    linkTo: null
  },
  {
    rank: 24, name: 'Grok 4', vendor: 'xAI', accent: '#f2685f',
    score: 78.3, scoreNote: 'X 实时数据接入 · 256K 上下文',
    ctx: '256K', price: '付费 · 中端', open: false, modality: '文本 / 图像',
    pros: ['X 平台实时数据接入，时事问答最强', '256K 上下文，长文与代码都不弱', '推理分紧追第一梯队'],
    best: '需要最新资讯、社交媒体舆情、实时信息的任务。',
    avoid: '严谨合规场景（风格偏自由）。',
    linkTo: null
  },
  {
    rank: 25, name: 'Mistral Large 3', vendor: 'Mistral AI', accent: '#34d3c4',
    score: 77.6, scoreNote: '欧洲最强闭源 · 多语言突出',
    ctx: '128K', price: '付费 · 中端', open: false, modality: '文本 / 图像',
    pros: ['欧洲最强闭源模型，多语言（法 / 德）突出', '128K 上下文，企业级 API 稳定', '函数调用与结构化输出成熟'],
    best: '面向欧洲市场、多语言企业应用、合规要求高的业务。',
    avoid: '追求极致性价比（比开源同档贵）。',
    linkTo: null
  },
  {
    rank: 26, name: 'GPT-5.6 mini', vendor: 'OpenAI', accent: '#6b8afd',
    score: 77.0, scoreNote: 'OpenAI 系低价主力 · 200K 上下文',
    ctx: '200K', price: '付费 · 中低端', open: false, modality: '文本 / 图像',
    pros: ['OpenAI 系低价主力，质量接近 Sol 的 90%', '200K 上下文，速度快延迟低', '与 GPT 系列 API 无缝切换'],
    best: '量大、单价敏感、又要 OpenAI 生态的批量任务。',
    avoid: '极限复杂推理（让位 Sol / Astra）。',
    linkTo: null
  },
  {
    rank: 27, name: 'Gemini 3 Pro', vendor: 'Google', accent: '#f5a524',
    score: 76.4, scoreNote: '原生全模态旗舰 · 视频理解最强',
    ctx: '1M', price: '付费 · 高端档', open: false, modality: '文本 / 图像 / 视频 / 音频',
    pros: ['原生全模态旗舰，视频理解业界最强', '1M 上下文，超长多模态文档一次读完', 'Vertex / AI Studio 企业接入成熟'],
    best: '需要看视频、听音频、吃超长多模态资料的专业分析。',
    avoid: '国内直连（需代理）；预算敏感场景。',
    linkTo: null
  },
  {
    rank: 28, name: 'Claude Haiku 5', vendor: 'Anthropic', accent: '#a78bfa',
    score: 75.8, scoreNote: 'Anthropic 最便宜档 · 速度极快',
    ctx: '200K', price: '付费 · 低价', open: false, modality: '文本 / 图像',
    pros: ['Anthropic 最便宜档，速度极快', '写作自然度仍优于多数同价位模型', '适合高并发嵌入产品'],
    best: '产品内嵌的轻量 AI、高并发客服、分类打标。',
    avoid: '复杂推理与长链路规划（让位 Sonnet / Opus）。',
    linkTo: null
  },
  {
    rank: 29, name: '文心 5.0（ERNIE 5.0）', vendor: '百度（文心）', accent: '#34d3c4',
    score: 75.2, scoreNote: '国产闭源旗舰 · 中文检索强',
    ctx: '256K', price: '付费 · 中端', open: false, modality: '文本 / 图像',
    pros: ['国产闭源旗舰，中文知识与检索强', '百度搜索 + 文心一言生态打通', '政企合规场景落地案例最多'],
    best: '国内政企、搜索增强、合规要求的业务。',
    avoid: '海外部署；英文创意写作。',
    linkTo: null
  },
  {
    rank: 30, name: 'Command A', vendor: 'Cohere', accent: '#6b8afd',
    score: 74.6, scoreNote: '企业 RAG 与检索增强老牌强者',
    ctx: '128K', price: '付费 · 中端', open: false, modality: '文本',
    pros: ['企业 RAG 与检索增强场景的老牌强者', '长文档 grounding 准确，幻觉率低', '多语言 Embed / 重排一体化'],
    best: '企业知识库问答、检索增强生成（RAG）管线。',
    avoid: '通用创意写作；多模态。',
    linkTo: null
  },
  {
    rank: 31, name: 'MiniMax M3', vendor: 'MiniMax（稀宇）', accent: '#34d3c4',
    score: 74.0, scoreNote: '国产开源 · 1M 上下文 · 多模态生态',
    ctx: '1M', price: '开源权重 · 低价 API', open: true, modality: '文本 / 图像',
    pros: ['国产开源，1M 上下文长文本强', '语音 / 视频多模态生态完整', 'API 价格低，社区活跃'],
    best: '中文长文、音视频多模态、成本敏感的项目。',
    avoid: '极限编码（让位 Qwen / DeepSeek）。',
    linkTo: null
  },
  {
    rank: 32, name: 'Nemotron Ultra 253B', vendor: 'NVIDIA', accent: '#6b8afd',
    score: 73.4, scoreNote: 'NVIDIA 开源旗舰 · GPU 推理优化最好',
    ctx: '128K', price: '开源权重 · 自部署免费', open: true, modality: '文本',
    pros: ['NVIDIA 开源旗舰，GPU 推理优化最好', '253B MoE，企业级 API 稳定', '与 CUDA / TensorRT-LLM 深度适配'],
    best: '在 N 卡集群上自部署、追求推理吞吐的企业。',
    avoid: '需要多模态；消费级显卡跑不动。',
    linkTo: null
  },
  {
    rank: 33, name: 'Qwen3-Coder', vendor: '阿里巴巴', accent: '#f2685f',
    score: 72.8, scoreNote: '专为代码而生 · 256K 上下文',
    ctx: '256K', price: '开源权重 · 阿里云低价', open: true, modality: '文本',
    pros: ['专为代码而生，仓库级补全与重构强', '256K 上下文，能吞下整个大项目', 'Agent 编码工具链（CLI）支持好'],
    best: '自动化编码 Agent、IDE 补全、大仓库重构。',
    avoid: '通用对话 / 创意写作（非其强项）。',
    linkTo: null
  },
  {
    rank: 34, name: '豆包 Pro（Doubao）', vendor: '字节跳动（豆包）', accent: '#f5a524',
    score: 72.2, scoreNote: '字节生态打通 · 低价高吞吐',
    ctx: '256K', price: '付费 · 低价', open: false, modality: '文本 / 图像',
    pros: ['字节生态（抖音 / 飞书）打通，国内延迟极低', '低价高吞吐，适合海量调用', '中文口语化表达自然'],
    best: '国内 C 端产品、海量低延迟对话、内容审核。',
    avoid: '海外合规与多语言；极限推理。',
    linkTo: null
  },
  {
    rank: 35, name: 'Mistral 3', vendor: 'Mistral AI', accent: '#34d3c4',
    score: 71.6, scoreNote: '轻量开源 · 单卡可跑',
    ctx: '128K', price: '开源权重 · 自部署免费', open: true, modality: '文本',
    pros: ['轻量开源，单卡可跑，部署门槛低', '欧洲数据合规友好', '指令遵循干净，适合做基座'],
    best: '资源受限、要自部署且合规的轻量应用。',
    avoid: '需要旗舰智能的硬任务。',
    linkTo: null
  },
  {
    rank: 36, name: 'Gemma 3（27B）', vendor: 'Google', accent: '#f5a524',
    score: 71.0, scoreNote: 'Google 开源 · 单卡可跑且扎实',
    ctx: '128K', price: '开源权重 · 自部署免费', open: true, modality: '文本 / 图像',
    pros: ['Google 开源，单卡可跑且质量扎实', '多语言覆盖广，视觉理解可用', 'Kaggle / Colab 一键体验'],
    best: '个人 / 小团队自部署、多语言轻量应用。',
    avoid: '超长上下文；顶级推理。',
    linkTo: null
  },
  {
    rank: 37, name: 'Kimi K2', vendor: 'Moonshot AI（月之暗面）', accent: '#f5a524',
    score: 70.4, scoreNote: 'K3 上一代旗舰 · 开源生态成熟',
    ctx: '256K', price: '开源权重 · 低价 API', open: true, modality: '文本',
    pros: ['K3 的上一代旗舰，开源生态成熟', '256K 长上下文，Agent 工具调用稳', '中文长文处理口碑好'],
    best: '长文 Agent、需要稳定开源长上下文的项目。',
    avoid: '追求最新最高分（已被 K3 取代）。',
    linkTo: null
  },
  {
    rank: 38, name: '阶跃 Step-3', vendor: '阶跃星辰', accent: '#34d3c4',
    score: 69.8, scoreNote: '国产开源新锐 · 多模态与推理兼顾',
    ctx: '128K', price: '开源权重 · 低价 API', open: true, modality: '文本 / 图像',
    pros: ['国产开源新锐，多模态与推理兼顾', 'Step 系列工具链逐步完善', '中文场景优化到位'],
    best: '中文多模态、想尝鲜国产开源新模型的团队。',
    avoid: '生态成熟度不如 Qwen / DeepSeek。',
    linkTo: null
  },
  {
    rank: 39, name: 'Amazon Nova Pro', vendor: 'Amazon', accent: '#f2685f',
    score: 69.2, scoreNote: 'AWS 原生 · 300K · 多模态',
    ctx: '300K', price: '付费 · 中端', open: false, modality: '文本 / 图像 / 视频',
    pros: ['AWS 原生，Bedrock 一键接入', '300K 长上下文，视频理解可用', '企业级 SLA 与合规完善'],
    best: '已在 AWS 体系、要长上下文多模态的企业。',
    avoid: '非 AWS 环境（迁移成本高）。',
    linkTo: null
  },
  {
    rank: 40, name: 'GPT-5.1', vendor: 'OpenAI', accent: '#6b8afd',
    score: 68.6, scoreNote: '上一代旗舰 · 生态极成熟',
    ctx: '200K', price: '付费 · 中端', open: false, modality: '文本 / 图像',
    pros: ['上一代旗舰，稳定性与生态极成熟', '200K 上下文，工具调用可靠', '大量现成教程与集成'],
    best: '求稳、要最大生态兼容的存量项目。',
    avoid: '新项目优先 5.6 系列（更强更便宜）。',
    linkTo: null
  },
  {
    rank: 41, name: 'Gemini 3.5 Flash', vendor: 'Google', accent: '#f5a524',
    score: 68.0, scoreNote: 'Flash 系低价主力 · 1M 上下文',
    ctx: '1M', price: '免费额度 + 付费', open: false, modality: '文本 / 图像 / 视频',
    pros: ['Flash 系低价主力，1M 上下文', '原生多模态，免费额度起步', '移动端 / 边缘场景优化好'],
    best: '免费起步的多模态原型、移动端 AI。',
    avoid: '需要顶级推理质量。',
    linkTo: null
  },
  {
    rank: 42, name: '零一万物 Yi-Large', vendor: '零一万物', accent: '#34d3c4',
    score: 67.4, scoreNote: '国产开源 · 中英文均衡',
    ctx: '128K', price: '开源权重 · 低价 API', open: true, modality: '文本',
    pros: ['国产开源，中英文均衡', '长上下文版本可选，部署简单', 'API 价格友好'],
    best: '中文业务自部署、成本敏感的通用服务。',
    avoid: '多模态；顶级编码。',
    linkTo: null
  },
  {
    rank: 43, name: 'Mistral Codestral', vendor: 'Mistral AI', accent: '#34d3c4',
    score: 66.8, scoreNote: '专注代码补全 · 80+ 语言',
    ctx: '128K', price: '付费 · 中端', open: false, modality: '文本',
    pros: ['专注代码补全，IDE 集成顺滑', '80+ 编程语言覆盖', '低延迟，本地化补全体验好'],
    best: 'IDE 实时代码补全、小模型本地编码助手。',
    avoid: '通用对话与多模态。',
    linkTo: null
  },
  {
    rank: 44, name: '百川 Baichuan4', vendor: '百川智能', accent: '#f5a524',
    score: 66.2, scoreNote: '国产闭源 · 医疗 / 金融垂类强',
    ctx: '128K', price: '付费 · 中端', open: false, modality: '文本 / 图像',
    pros: ['国产闭源，中文医疗 / 金融垂类强', '128K 上下文，私有化部署方案成熟', '国内政企案例多'],
    best: '中文垂类（医疗 / 金融）、政企私有化。',
    avoid: '海外与多语言；顶级通用推理。',
    linkTo: null
  },
  {
    rank: 45, name: 'Claude Opus 4.5', vendor: 'Anthropic', accent: '#a78bfa',
    score: 65.6, scoreNote: '上一代 Opus · 编码与写作仍强',
    ctx: '200K', price: '付费 · 高端档', open: false, modality: '文本 / 图像',
    pros: ['上一代 Opus，编码与写作仍强', '200K 上下文，稳定可靠', '存量项目兼容性好'],
    best: '存量 Claude 项目、需要 Opus 级质量的稳妥选择。',
    avoid: '新项目优先 Opus 5（更强更优）。',
    linkTo: null
  },
  {
    rank: 46, name: 'OLMo 2', vendor: 'AllenAI', accent: '#34d3c4',
    score: 65.0, scoreNote: '完全开放（含训练数据）· 科研级',
    ctx: '32K', price: '开源权重 · 自部署免费', open: true, modality: '文本',
    pros: ['完全开放（含训练数据）的科研级开源', '可复现、可二次研究', '教学与论文首选'],
    best: '学术研究、模型可解释性、训练复现。',
    avoid: '生产环境（上下文短、无多模态）。',
    linkTo: null
  },
  {
    rank: 47, name: 'Perplexity Sonar', vendor: 'Perplexity', accent: '#6b8afd',
    score: 64.4, scoreNote: '联网检索 + 引用溯源',
    ctx: '128K', price: '付费 · 中端', open: false, modality: '文本',
    pros: ['联网检索 + 引用溯源，答案可查', '实时信息最强之一', '适合事实型问答'],
    best: '需要实时联网、带引用的事实问答。',
    avoid: '闭门创意写作；长文生成。',
    linkTo: null
  },
  {
    rank: 48, name: 'Granite 4', vendor: 'IBM', accent: '#6b8afd',
    score: 63.8, scoreNote: 'IBM 企业级开源 · 治理合规完善',
    ctx: '128K', price: '开源权重 · 自部署免费', open: true, modality: '文本',
    pros: ['IBM 企业级开源，治理与合规完善', '可商用协议友好', '企业集成（watsonx）成熟'],
    best: '企业合规、可审计、要商用友好的自部署。',
    avoid: '消费级创意；多模态。',
    linkTo: null
  },
  {
    rank: 49, name: 'Jamba 2', vendor: 'AI21', accent: '#34d3c4',
    score: 63.2, scoreNote: 'SSM+Transformer 混合 · 256K 省显存',
    ctx: '256K', price: '开源权重 · 低价 API', open: true, modality: '文本',
    pros: ['SSM+Transformer 混合架构，长上下文省显存', '256K 长文处理成本低', '企业 API 稳定'],
    best: '超长文档、要省显存的长上下文任务。',
    avoid: '多模态；顶级推理。',
    linkTo: null
  },
  {
    rank: 50, name: 'Falcon 3', vendor: 'TII', accent: '#f5a524',
    score: 62.6, scoreNote: 'TII 开源 · 阿语 / 英语双语',
    ctx: '32K', price: '开源权重 · 自部署免费', open: true, modality: '文本',
    pros: ['TII 开源，阿语 / 英语双语强', '轻量可单卡部署', '中东合规友好'],
    best: '阿语市场、轻量自部署、双语应用。',
    avoid: '中文场景；长上下文与多模态。',
    linkTo: null
  }
];

/* ============================================================
 * 首屏引导卡片（3D 叠卡动效用）
 * tab 字段对应 app.js 里的 state.tab
 * ============================================================ */
const INTRO_MODULES = [
  {
    id: 'rank', icon: '🏆', tag: 'TOP 50', accent: '#f5a524',
    title: '全球排名 Top 50',
    desc: '按 7 家独立榜单聚合排序，点开看每个模型的优势、该用来干什么、别用来干什么。',
    cta: '看排行榜', tab: 'rank'
  },
  {
    id: 'hw', icon: '🖥️', tag: '选模型', accent: '#6b8afd',
    title: '按你的硬件选',
    desc: '选个显存档位，直接告诉你该装哪 1-2 个本地模型。8 档从无独显到多卡服务器全覆盖。',
    cta: '选我的显卡', tab: 'hw'
  },
  {
    id: 'need', icon: '🎯', tag: '按场景', accent: '#34d3c4',
    title: '按你要做的事选',
    desc: '写代码 / Agent / 看图 / 推理 / 长文档……每个场景都给你「免费能用的」和「付费最强的」两套。',
    cta: '选我的场景', tab: 'need'
  },
  {
    id: 'lib', icon: '📦', tag: '检索', accent: '#a78bfa',
    title: '模型库全检索',
    desc: '全部收录模型，按本地 / API、免费 / 付费、能力标签交叉筛选，支持关键词搜索。',
    cta: '进模型库', tab: 'lib'
  },
  {
    id: 'basics', icon: '🚀', tag: '新手', accent: '#f2685f',
    title: '新手 6 步跑通',
    desc: '从零装 Ollama 到「所有软件都能调用你的本地模型」，命令可直接复制。',
    cta: '开始 6 步', tab: 'basics'
  },
  {
    id: 'lab', icon: '🧪', tag: '共建', accent: '#30c85e',
    title: '实验室 · 实测回帖',
    desc: '信息过期、命令跑不通、想看的模型没收录——留言，我实机测完把结论回帖在这里。',
    cta: '去实验室', tab: 'lab'
  }
];
