/// <reference lib="webworker" />
// Runs Whisper (speech to text) off the main thread so the app stays responsive.
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

export type WorkerRequest =
  | { type: 'load'; model: string }
  | { type: 'transcribe'; id: number; audio: Float32Array; language?: string }

export type WorkerResponse =
  | { type: 'download'; loaded: number; total: number }
  | { type: 'ready'; device: string }
  | { type: 'result'; id: number; chunks: { start: number; end: number; text: string }[] }
  | { type: 'error'; message: string }

let asr: AutomaticSpeechRecognitionPipeline | undefined
const post = (m: WorkerResponse) => self.postMessage(m)

async function load(model: string) {
  const gpu = 'gpu' in navigator && !!(await (navigator as unknown as { gpu: GPU }).gpu.requestAdapter().catch(() => null))
  const options = {
    progress_callback: (p: { status: string; loaded?: number; total?: number }) => {
      if (p.status === 'progress_total') post({ type: 'download', loaded: p.loaded ?? 0, total: p.total ?? 0 })
    },
  }
  asr = gpu
    ? await pipeline('automatic-speech-recognition', model, {
        ...options,
        device: 'webgpu',
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
      })
    : await pipeline('automatic-speech-recognition', model, { ...options, device: 'wasm', dtype: 'q8' })
  post({ type: 'ready', device: gpu ? 'webgpu' : 'wasm' })
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  try {
    if (msg.type === 'load') return await load(msg.model)
    if (!asr) throw new Error('Speech model is not loaded yet.')
    const out = await asr(msg.audio, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      ...(msg.language ? { language: msg.language, task: 'transcribe' } : {}),
    })
    const result = Array.isArray(out) ? out[0] : out
    const chunks = (result.chunks ?? []).map((c: { timestamp: [number, number | null]; text: string }) => ({
      start: c.timestamp[0] ?? 0,
      end: c.timestamp[1] ?? c.timestamp[0] ?? 0,
      text: c.text,
    }))
    post({ type: 'result', id: msg.id, chunks })
  } catch (err) {
    post({ type: 'error', message: (err as Error).message || String(err) })
  }
}
