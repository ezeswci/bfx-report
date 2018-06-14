'use strict'

const bfxFactory = require('./bfx.factory')

const getREST = (auth) => {
  if (typeof auth !== 'object') {
    throw new Error('ERR_ARGS_NO_AUTH_DATA')
  }

  const bfx = bfxFactory({ ...auth })

  return bfx.rest(2, { transform: true })
}

const getLimitNotMoreThan = (limit, maxLimit = 10000) => {
  if (
    Number.isFinite(limit) &&
    limit < maxLimit
  ) {
    return limit
  }

  return null
}

module.exports = {
  getREST,
  getLimitNotMoreThan
}
