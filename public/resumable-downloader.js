/**
 * @typedef {object} downloads
 * @property {AbortController} abortController
 * @property {string} id
 * @property {object} handle
 */

/** @type {Map<string, downloads>} */
const signals = new Map(/* id */)

/**
 * @param {string} url
 * @param {RequestInit} requestInit
 * @param {string} id
 */
async function download(url, requestInit, id) {
  const ctrl = new AbortController()
  const headers = new Headers(requestInit.headers || {})
  requestInit.signal = ctrl.signal
  requestInit.headers = headers

  // First figure out how much we need to download.
  let response = await fetch(url, { ...requestInit, method: 'HEAD' })
  const contentLength = response.headers.get('Content-Length')
  if (contentLength === null) {
    throw new Error('Content-Length header not found')
  }
  const size = parseInt(contentLength, 10)

  // Deal with troublesome headers.
  if (!response.headers.has('content-length')) {
    throw new Error('Content-Length header not found')
  }

  if (response.headers.has('content-encoding')) {
    // in this cases it would be better to just download raw compressed gz data
    // and then decompress it using DecompressionStream.
    throw new Error('Range requests are not supported \w content-encoding')
  }

  if (!response.headers.has('accept-ranges')) {
    throw new Error('accept-ranges header not found')
  }

  // Get a file handle from whatwg/fs
  const root = await navigator.storage.getDirectory()
  const fileHandle = await root.getFileHandle(id, { create: true })
  const handle = await fileHandle.createSyncAccessHandle()

  // figure out how much we've downloaded
  let downloaded = await handle.getSize()

  // if we've already downloaded everything, we're done
  if (downloaded >= size) {
    await handle.close()
    postMessage({ type: 'done', id, fileHandle })
    return
  }

  // Make a new request with the correct range
  headers.set('Range', `bytes=${downloaded}-`)
  response = await fetch(url, { ...requestInit })
  if (!response.body) {
    throw new Error('Response body is null')
  }

  const reader = response.body.getReader()

  // TODO: it would be better to use
  // `file.createAccessHandle({ mode: "in-place" })`
  // to avoid costly inter-process communication (IPCs) between renderer and
  // browser processes and simply just pipe the data directly from the response.
  // BUT.... that's not possible yet. whatwg/fs doesn't support in-place yet.
  // everything currently is atomically written to the file. So it needs to copy
  // the already downloaded data to a temp file and then atomically rename it.
  // that is a bit costly and slow. but luckily OPFS is smashing the whatwg/fs
  // on the fingers and tries to improve the performance to near native speed.
  //
  // https://github.com/whatwg/fs/blob/99b46e24c2c1f7f0245fe67415e2b82ee91d86e8/AccessHandle.md#what-makes-the-new-surface-fast
  //
  // also we need to deal with responses that can break mid-stream due to
  // network issues.

  // Write the response to the file
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    handle.write(value, { at: downloaded })
    // handle.flush()
    downloaded += value.length

    // send a message to the main thread to update the progress bar
    postMessage({
      type: 'progress',
      id,
      size,
      downloaded,
    })
  }

  // close the file handle
  await handle.flush()
  await handle.close()

  // send a message to the main thread that we're done
  postMessage({ type: 'done', id, fileHandle })
}

function cancel (id) {
  const download = signals.get(id)
  if (!download) return
  download.abortController.abort()
  download.handle.close()
  signals.delete(id)
}

function pause(id) {
  cancel(id)
}

function resume(id) {

}

onmessage = evt => {
  switch (evt.data.action) {
    case 'download':
      const { url, id, ...requestInit } = evt.data
      download(url, requestInit, id)
      break
    case 'cancel':
      cancel(evt.data.id)
      break
    case 'pause':
      pause(evt.data.id)
      break
    case 'resume':
      resume(evt.data.id)
      break
  }
}
