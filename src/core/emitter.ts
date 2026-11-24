import type { WidgetEvent } from './types';

export type Listener = (event: WidgetEvent) => void;

/** Tiny event emitter for analytics hooks. A failing listener never breaks the widget. */
export class Emitter {
  private listeners = new Set<Listener>();

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: WidgetEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[concierge] analytics listener failed', err);
      }
    }
  }
}
