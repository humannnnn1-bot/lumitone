/**
 * Fixed-capacity ring buffer (circular queue).
 * Avoids array spread/slice operations on push/pop.
 */
export class RingBuffer<T> {
  private _buf: (T | undefined)[];
  private _head = 0;  // index of first element
  private _len = 0;   // current number of elements
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this._buf = new Array(capacity);
  }

  get length(): number { return this._len; }

  /** Push to end. If full, overwrites oldest element. */
  push(item: T): void {
    const idx = (this._head + this._len) % this.capacity;
    if (this._len < this.capacity) {
      this._buf[idx] = item;
      this._len++;
    } else {
      // Overwrite oldest
      this._buf[idx] = item;
      this._head = (this._head + 1) % this.capacity;
    }
  }

  /** Pop from end. Returns undefined if empty. */
  pop(): T | undefined {
    if (this._len === 0) return undefined;
    this._len--;
    const idx = (this._head + this._len) % this.capacity;
    const item = this._buf[idx];
    this._buf[idx] = undefined; // allow GC
    return item;
  }

  /** Peek at end (last pushed). */
  peekLast(): T | undefined {
    if (this._len === 0) return undefined;
    return this._buf[(this._head + this._len - 1) % this.capacity];
  }

  /** Push to front. If full, drops oldest from end. */
  unshift(item: T): void {
    if (this._len < this.capacity) {
      this._head = (this._head - 1 + this.capacity) % this.capacity;
      this._buf[this._head] = item;
      this._len++;
    } else {
      // Drop last, insert at front
      this._head = (this._head - 1 + this.capacity) % this.capacity;
      this._buf[this._head] = item;
    }
  }

  /** Shift from front. Returns undefined if empty. */
  shift(): T | undefined {
    if (this._len === 0) return undefined;
    const item = this._buf[this._head];
    this._buf[this._head] = undefined;
    this._head = (this._head + 1) % this.capacity;
    this._len--;
    return item;
  }

  /** Get element at logical index. */
  at(index: number): T | undefined {
    if (index < 0 || index >= this._len) return undefined;
    return this._buf[(this._head + index) % this.capacity];
  }

  /** Clear all elements. */
  clear(): void {
    for (let i = 0; i < this._len; i++) {
      this._buf[(this._head + i) % this.capacity] = undefined;
    }
    this._head = 0;
    this._len = 0;
  }

  /** Convert to array (oldest first). */
  toArray(): T[] {
    const arr: T[] = new Array(this._len);
    for (let i = 0; i < this._len; i++) {
      arr[i] = this._buf[(this._head + i) % this.capacity] as T;
    }
    return arr;
  }

  /** Create a shallow clone with same capacity and contents. */
  clone(): RingBuffer<T> {
    const rb = new RingBuffer<T>(this.capacity);
    rb._buf = this._buf.slice();
    rb._head = this._head;
    rb._len = this._len;
    return rb;
  }

  /** Create from existing array with given capacity. */
  static from<T>(items: T[], capacity: number): RingBuffer<T> {
    const rb = new RingBuffer<T>(capacity);
    const start = Math.max(0, items.length - capacity);
    for (let i = start; i < items.length; i++) {
      rb.push(items[i]);
    }
    return rb;
  }
}
