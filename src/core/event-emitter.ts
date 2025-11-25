/**
 * 类型安全的事件发射器
 */

export class EventEmitter<TEvents extends Record<string, unknown>> {
  private listeners = new Map<
    keyof TEvents,
    Set<(data: TEvents[keyof TEvents]) => void>
  >();

  /**
   * 监听事件
   */
  on<K extends keyof TEvents>(
    event: K,
    listener: (data: TEvents[K]) => void,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener as never);

    // 返回取消监听函数
    return () => this.off(event, listener);
  }

  /**
   * 监听一次事件
   */
  once<K extends keyof TEvents>(
    event: K,
    listener: (data: TEvents[K]) => void,
  ): () => void {
    const wrapper = (data: TEvents[K]) => {
      this.off(event, wrapper);
      listener(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * 取消监听事件
   */
  off<K extends keyof TEvents>(
    event: K,
    listener: (data: TEvents[K]) => void,
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener as never);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * 触发事件
   */
  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(data);
        } catch (error) {
          console.error(
            `Error in event listener for "${String(event)}":`,
            error,
          );
        }
      }
    }
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount(event: keyof TEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
