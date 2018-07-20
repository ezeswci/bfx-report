'use strict'

const { Api } = require('bfx-wrk-api')
const {
  getREST,
  getParams
} = require('./helpers')

class ReportService extends Api {
  space (service, msg) {
    const space = super.space(service, msg)
    return space
  }

  async getFundingInfo (space, args, cb) {
    try {
      const rest = getREST(args.auth, this.ctx.grc_bfx.caller)
      const result = await rest.fundingInfo()

      cb(null, result)
    } catch (err) {
      cb(err)
    }
  }

  async getLedgers (space, args, cb) {
    try {
      const maxLimit = 5000
      const params = getParams(args, maxLimit)
      const rest = getREST(args.auth, this.ctx.grc_bfx.caller)
      const result = await rest.ledgers(...params)

      cb(null, result)
    } catch (err) {
      console.log('getLedgers error: ', err.toString())
      cb(err)
    }
  }

  async getTrades (space, args, cb) {
    try {
      const maxLimit = 1500
      const params = getParams(args, maxLimit)
      const rest = getREST(args.auth, this.ctx.grc_bfx.caller)
      const result = await rest.accountTrades(...params)

      cb(null, result)
    } catch (err) {
      console.log('getMovements error: ', err.toString())
      cb(err)
    }
  }

  async getOrders (space, args, cb) {
    try {
      const maxLimit = 5000
      const params = getParams(args, maxLimit)
      const rest = getREST(args.auth, this.ctx.grc_bfx.caller)
      const result = await rest.orderHistory(...params)

      cb(null, result)
    } catch (err) {
      console.log('getOrders error: ', err.toString())
      cb(err)
    }
  }

  async getMovements (space, args, cb) {
    try {
      const maxLimit = 25
      console.log('args', args)
      const params = getParams(args, maxLimit)
      console.log('params', params) // simbol start end limit
      const rest = getREST(args.auth, this.ctx.grc_bfx.caller)
      const result = await rest.movements(...params)
      console.log('result', result)
      cb(null, result)
    } catch (err) {
      console.log('getMovements error: ', err.toString())
      cb(err)
    }
  }
}

module.exports = ReportService
