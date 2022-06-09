import { randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'

export function createRandomStream(size = Infinity) {
  return new RandomReadable(size)
}

class RandomReadable extends Readable {
  #size
  #currentSize = 0
  #isDestroyed = false

  /** @param {number} size */
  constructor(size) {
    super()
    this.#size = size
  }

  /** @param {number} size */
  _read(size) {
    if (this.#currentSize >= this.#size) {
      return this.push(null)
    } else if (this.#currentSize + size >= this.#size) {
      size = this.#size - this.#currentSize
    }
    this.#currentSize += size

    randomBytes(size, (err, buf) => {
      if (this.#isDestroyed) {
        return
      }

      if (err) {
        this.emit('error', err)
        return
      }

      this.push(buf)
    })
  }

  /**
   * @param {Error | null} error
   * @param {(error: Error | null) => void} callback
   */
  _destroy(error, callback) {
    this.#isDestroyed = true
    super._destroy(error, callback)
  }
}
