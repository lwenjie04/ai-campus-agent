export const createClientDisconnectError = () => {
  const error = new Error('Chat client disconnected')
  error.name = 'AbortError'
  error.code = 'CLIENT_DISCONNECTED'
  return error
}

export const createChatCancellation = (req, res, onQuotaSettle) => {
  const controller = new AbortController()
  let firstDeltaEmitted = false
  let quotaSettled = false
  let connection

  const settle = (outcome) => {
    if (quotaSettled) return
    quotaSettled = true
    onQuotaSettle(outcome)
  }

  connection = watchChatClientConnection(req, res, (error) => {
    controller.abort(error)
    settle(firstDeltaEmitted ? 'commit' : 'rollback')
  })

  return {
    signal: controller.signal,
    markFirstDelta() {
      firstDeltaEmitted = true
    },
    settle,
    dispose: connection.dispose,
    markResponseFinished: connection.markResponseFinished,
  }
}

export const watchChatClientConnection = (req, res, onDisconnect) => {
  let disconnected = false
  let responseFinished = false

  const cleanup = () => {
    req.off('aborted', onRequestAborted)
    req.off('close', onRequestClose)
    req.socket?.off('close', onSocketClose)
    res.off('close', onResponseClose)
    res.off('finish', onResponseFinish)
  }

  const markDisconnected = () => {
    if (disconnected || responseFinished || res.writableFinished) return
    disconnected = true
    onDisconnect(createClientDisconnectError())
    cleanup()
  }

  const onRequestAborted = () => markDisconnected()
  const onRequestClose = () => {
    // IncomingMessage also emits close after the request body is read normally.
    // Only an incomplete request indicates an aborted upload.
    if (req.aborted || !req.complete || req.socket?.destroyed) markDisconnected()
  }
  const onSocketClose = () => {
    markDisconnected()
  }
  const onResponseClose = () => {
    // A normal ServerResponse close follows finish; a premature close means the
    // downstream client or proxy stopped reading the stream.
    if (!res.writableFinished) markDisconnected()
  }
  const onResponseFinish = () => {
    responseFinished = true
    cleanup()
  }

  req.once('aborted', onRequestAborted)
  req.once('close', onRequestClose)
  req.socket?.once('close', onSocketClose)
  res.once('close', onResponseClose)
  res.once('finish', onResponseFinish)

  return {
    get disconnected() {
      return disconnected
    },
    dispose: cleanup,
    markResponseFinished() {
      responseFinished = true
      cleanup()
    },
  }
}
