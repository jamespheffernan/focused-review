// timer.ts
export function createTimer(onTick: (remaining: number)=>void) {
  let remaining = 0, running = false, id: number | null = null
  const tick = () => { if (!running) return; remaining -= 1; onTick(remaining); id = window.setTimeout(tick, 1000) }
  return {
    start(seconds: number) { remaining = seconds; running = true; if (id) clearTimeout(id); id = window.setTimeout(tick, 1000); onTick(remaining) },
    pause() { running = false },
    resume() { if (!running) { running = true; id = window.setTimeout(tick, 1000) } },
    add(sec: number) { remaining += sec; onTick(remaining) }
  }
}
