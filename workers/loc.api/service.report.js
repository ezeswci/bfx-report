'use strict'

const { Api } = require('bfx-wrk-api')

const {
  getREST,
  checkParams,
  getCsvStoreStatus,
  toString,
  parseFields,
  accountCache,
  getTimezoneConf,
  prepareApiResponse
} = require('./helpers')
const {
  getTradesCsvJobData,
  getTickersHistoryCsvJobData,
  getWalletsCsvJobData,
  getPositionsHistoryCsvJobData,
  getPositionsAuditCsvJobData,
  getPublicTradesCsvJobData,
  getLedgersCsvJobData,
  getOrdersCsvJobData,
  getMovementsCsvJobData,
  getFundingOfferHistoryCsvJobData,
  getFundingLoanHistoryCsvJobData,
  getFundingCreditHistoryCsvJobData,
  getMultipleCsvJobData
} = require('./helpers/get-csv-job-data')

class ReportService extends Api {
  space (service, msg) {
    const space = super.space(service, msg)
    return space
  }

  isSyncModeConfig (space, args, cb = () => { }) {
    const wrk = this.ctx.grc_bfx.caller
    const group = wrk.group
    const conf = wrk.conf[group]

    cb(null, conf.syncMode)

    return conf.syncMode
  }

  _getUserInfo (args) {
    const rest = getREST(args.auth, this.ctx.grc_bfx.caller)

    return rest.userInfo()
  }

  async _getUsername (args) {
    try {
      const { username } = await this._getUserInfo(args)

      if (!username || typeof username !== 'string') {
        return false
      }

      return username
    } catch (err) {
      return false
    }
  }

  async getEmail (space, args, cb) {
    try {
      const result = await this._getUserInfo(args)

      cb(null, result.email)
    } catch (err) {
      this._err(err, 'getEmail', cb)
    }
  }

  async getUsersTimeConf (space, args, cb) {
    try {
      const { timezone } = await this._getUserInfo(args)
      const result = getTimezoneConf(timezone)

      cb(null, result)
    } catch (err) {
      this._err(err, 'getUsersTimeConf', cb)
    }
  }

  lookUpFunction (space, args, cb) {
    try {
      if (typeof args.params !== 'object') {
        throw new Error('ERR_ARGS_NO_PARAMS')
      }

      const { service } = args.params
      const grape = this.ctx.grc_bfx

      grape.link.lookup(service, (err, res) => {
        const amount = (!err) ? res.length : 0

        cb(null, amount)
      })
    } catch (err) {
      this._err(err, 'lookUpFunction', cb)
    }
  }

  async getSymbols (space, args, cb) {
    try {
      const cache = accountCache.get('symbols')

      if (cache) return cb(null, cache)

      const pairs = await this._getSymbols()
      const currencies = await this._getCurrencies()
      const result = { pairs, currencies }
      accountCache.set('symbols', result)

      cb(null, result)
    } catch (err) {
      this._err(err, 'getSymbols', cb)
    }
  }

  _getSymbols () {
    const rest = getREST({}, this.ctx.grc_bfx.caller)

    return rest.symbols()
  }

  _getCurrencies () {
    const rest = getREST({}, this.ctx.grc_bfx.caller)

    return rest.currencies()
  }

  async getTickersHistory (space, args, cb) {
    try {
      if (
        args &&
        typeof args === 'object' &&
        args.params &&
        typeof args.params === 'object' &&
        args.params.symbol &&
        typeof args.params.symbol === 'string'
      ) {
        args.params.symbol = [args.params.symbol]
      }

      args.auth = {}

      const res = await prepareApiResponse(
        args,
        this.ctx.grc_bfx.caller,
        'tickersHistory',
        'mtsUpdate',
        null,
        ['symbol']
      )

      cb(null, res)
    } catch (err) {
      this._err(err, 'getTickersHistory', cb)
    }
  }

  async getPositionsHistory (space, args, cb) {
    try {
      const res = await prepareApiResponse(
        args,
        this.ctx.grc_bfx.caller,
        'positionsHistory',
        'mtsUpdate',
        'symbol'
      )

      cb(null, res)
    } catch (err) {
      this._err(err, 'getPositionsHistory', cb)
    }
  }

  async getPositionsAudit (space, args, cb) {
    try {
      const res = await prepareApiResponse(
        args,
        this.ctx.grc_bfx.caller,
        'positionsAudit',
        'mtsUpdate',
        'symbol'
      )

      cb(null, res)
    } catch (err) {
      this._err(err, 'getPositionsAudit', cb)
    }
  }

  async getWallets (space, args, cb) {
    try {
      checkParams(args, 'paramsSchemaForWallets')

      const rest = getREST(args.auth, this.ctx.grc_bfx.caller)
      const end = args.params && args.params.end

      const result = (end)
        ? await rest.walletsHistory(end)
        : await rest.wallets()

      cb(null, result)
    } catch (err) {
      this._err(err, 'getWallet', cb)
    }
  }

  async getLedgers (space, args, cb) {
    try {
      const res = await prepareApiResponse(
        args,
        this.ctx.grc_bfx.caller,
        'ledgers',
        'mts',
        'currency'
      )

      cb(null, res)
    } catch (err) {
      this._err(err, 'getLedgers', cb)
    }
  }

  async getTrades (space, args, cb) {
    try {
      const res = await prepareApiResponse(
        args,
        this.ctx.grc_bfx.caller,
        'trades',
        'mtsCreate',
        'symbol'
      )

      cb(null, res)
    } catch (err) {
      this._err(err, 'getTrades', cb)
    }
  }

  async getPublicTrades (space, args, cb) {
    try {
      args.auth = {}

      const res = await prepareApiResponse(
        args,
        this.ctx.grc_bfx.caller,
        'publicTrades',
        'mts',
        ['symbol']
      )

      cb(null, res)
    } catch (err) {
      this._err(err, 'getPublicTrades', cb)
    }
  }

  async getOrders (space, args, cb) {
    try {
      const res = await prepareApiResponse(
        args,
        this.ctx.grc_bfx.caller,
        'orders',
        'mtsUpdate',
        'symbol'
      )
      res.res = parseFields(res.res, { executed: true })

      cb(null, res)
    } catch (err) {
      this._err(err, 'getOrders', cb)
    }
  }

  async getMovements (space, args, cb) {
    try {
      const res = {"res":[{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":8253236,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1516183404000,"mtsUpdated":1516184562000,"status":"COMPLETED","amount":-4220,"fees":0,"destinationAddress":"17JKYQ5ZdvzoqT12Lm3PaCdbsY79GGsrpc","transactionId":"cd8b8825bc11ce1ecec5197bd5b0cfb56a855c2490f7a472ba0723c0f686fc9c"},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":8237196,"currency":"ETH","currencyName":"ETHEREUM","mtsStarted":1516143410000,"mtsUpdated":1516143697000,"status":"COMPLETED","amount":-152.56,"fees":0,"destinationAddress":"0x93fba52840c83be682c86011188ab319e3d95ba1","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7937604,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1515378862000,"mtsUpdated":1515379748000,"status":"COMPLETED","amount":-120865,"fees":0,"destinationAddress":"17JKYQ5ZdvzoqT12Lm3PaCdbsY79GGsrpc","transactionId":"dc3a152c4b461c72380287f318f76f8165fb0f11307273c51e45cfa2d1f9a8b8"},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7923584,"currency":"ETH","currencyName":"ETHEREUM","mtsStarted":1515344756000,"mtsUpdated":1515345509000,"status":"COMPLETED","amount":-524.44,"fees":0,"destinationAddress":"0xf09a68d5897197aca57ccef8a2c7e2969847f3ef","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7910135,"currency":"ETH","currencyName":"ETHEREUM","mtsStarted":1515317288000,"mtsUpdated":1515318145000,"status":"COMPLETED","amount":-995.89,"fees":0,"destinationAddress":"0xf09a68d5897197aca57ccef8a2c7e2969847f3ef","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7876768,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1515235822000,"mtsUpdated":1515238955000,"status":"COMPLETED","amount":-4601,"fees":0,"destinationAddress":"17JKYQ5ZdvzoqT12Lm3PaCdbsY79GGsrpc","transactionId":"38f519a1949cb85a356028af66e05aafc6bdb15be1d0289114a5af36c46d3751"},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7813194,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1515102686000,"mtsUpdated":1515105866000,"status":"COMPLETED","amount":-24799,"fees":0,"destinationAddress":"17JKYQ5ZdvzoqT12Lm3PaCdbsY79GGsrpc","transactionId":"292ce6cf4dd58a1ba602f25fd434f49c7a0178e3bf1b6892f5853c17820a21f7"},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7743963,"currency":"ETH","currencyName":"ETHEREUM","mtsStarted":1514988874000,"mtsUpdated":1514991836000,"status":"COMPLETED","amount":-268.5,"fees":0,"destinationAddress":"0x93fba52840c83be682c86011188ab319e3d95ba1","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7727871,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1514955568000,"mtsUpdated":1514960917000,"status":"COMPLETED","amount":-26977,"fees":0,"destinationAddress":"17JKYQ5ZdvzoqT12Lm3PaCdbsY79GGsrpc","transactionId":"c433ef13540b7eb75335a3fe6f90561825ae6db07db36badb0340260529a8980"},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7727905,"currency":"ETH","currencyName":"ETHEREUM","mtsStarted":1514955651000,"mtsUpdated":1514960607000,"status":"COMPLETED","amount":-79.12,"fees":0,"destinationAddress":"0xf09a68d5897197aca57ccef8a2c7e2969847f3ef","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7693160,"currency":"ETH","currencyName":"ETHEREUM","mtsStarted":1514879180000,"mtsUpdated":1514881238000,"status":"COMPLETED","amount":-162.24,"fees":0,"destinationAddress":"0xf09a68d5897197aca57ccef8a2c7e2969847f3ef","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7693208,"currency":"BCH","currencyName":"BCASH","mtsStarted":1514879398000,"mtsUpdated":1514881178000,"status":"COMPLETED","amount":-0.9,"fees":0,"destinationAddress":"15Xb1waGTkyFVPX6R5NLjSKuuXVoknYN66","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7679361,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1514838453000,"mtsUpdated":1514843327000,"status":"COMPLETED","amount":-34095,"fees":0,"destinationAddress":"1M3YDWxxSXAvZpDdgwN5WGNYWtaBiLrVcE","transactionId":"261377aa83fb77d20d492689e9b6724cfd29bc403295893ac1bd5dbbaaad7040"},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7670340,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1514811022000,"mtsUpdated":1514813285000,"status":"COMPLETED","amount":-10656,"fees":0,"destinationAddress":"17JKYQ5ZdvzoqT12Lm3PaCdbsY79GGsrpc","transactionId":"d7f05fc66a91728e55628f1b3e02d61c818967add480e5b7c741977d42270663"},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7670396,"currency":"ETH","currencyName":"ETHEREUM","mtsStarted":1514811124000,"mtsUpdated":1514812378000,"status":"COMPLETED","amount":-4.4,"fees":0,"destinationAddress":"0xf09a68d5897197aca57ccef8a2c7e2969847f3ef","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7473990,"currency":"BTC","currencyName":"BITCOIN","mtsStarted":1514318542000,"mtsUpdated":1514318972000,"status":"COMPLETED","amount":-0.41,"fees":0,"destinationAddress":"1N2x1FPE8YaEgbT39sfgqB414aTosXR9kK","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7446275,"currency":"ETH","currencyName":"ETHEREUM","mtsStarted":1514235473000,"mtsUpdated":1514238198000,"status":"COMPLETED","amount":-26.72,"fees":0,"destinationAddress":"0xf09a68d5897197aca57ccef8a2c7e2969847f3ef","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7370059,"currency":"BTC","currencyName":"BITCOIN","mtsStarted":1514033004000,"mtsUpdated":1514049700000,"status":"COMPLETED","amount":-18.59,"fees":0,"destinationAddress":"1N2x1FPE8YaEgbT39sfgqB414aTosXR9kK","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7362101,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1514017039000,"mtsUpdated":1514022476000,"status":"COMPLETED","amount":-107214,"fees":0,"destinationAddress":"1M3YDWxxSXAvZpDdgwN5WGNYWtaBiLrVcE","transactionId":"fd9f2e49d3c2ad3e2abfa8c714fca79a834428158a201e3ffccc3e41976e0d02"},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7297308,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1513925721000,"mtsUpdated":1513929176000,"status":"COMPLETED","amount":-131799,"fees":0,"destinationAddress":"17JKYQ5ZdvzoqT12Lm3PaCdbsY79GGsrpc","transactionId":"2e2156e27e5a0018be633d7841e0a5581fc6c8c3a427f4561a51117d52378295"},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7277145,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1513890113000,"mtsUpdated":1513890828000,"status":"CANCELED","amount":-9969,"fees":-2,"destinationAddress":"0x93fba52840c83be682c86011188ab319e3d95ba1","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7232902,"currency":"USD","currencyName":"TETHERUSO","mtsStarted":1513824089000,"mtsUpdated":1513851415000,"status":"COMPLETED","amount":-21371,"fees":0,"destinationAddress":"17JKYQ5ZdvzoqT12Lm3PaCdbsY79GGsrpc","transactionId":"363bf01240b1452f187fc214a40136cd904d277b5829d308d29879e8bd9f5b23"},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7232945,"currency":"ETH","currencyName":"ETHEREUM","mtsStarted":1513824206000,"mtsUpdated":1513851336000,"status":"COMPLETED","amount":-42.57,"fees":0,"destinationAddress":"0xf09a68d5897197aca57ccef8a2c7e2969847f3ef","transactionId":null},{"_events":{},"_eventsCount":0,"_fields":{"id":0,"currency":1,"currencyName":2,"mtsStarted":5,"mtsUpdated":6,"status":9,"amount":12,"fees":13,"destinationAddress":16,"transactionId":20},"_boolFields":[],"_fieldKeys":["id","currency","currencyName","mtsStarted","mtsUpdated","status","amount","fees","destinationAddress","transactionId"],"id":7233040,"currency":"BCH","currencyName":"BCASH","mtsStarted":1513824382000,"mtsUpdated":1513851157000,"status":"COMPLETED","amount":-2.1,"fees":0,"destinationAddress":"15Xb1waGTkyFVPX6R5NLjSKuuXVoknYN66","transactionId":null}],"nextPage":1513795020000}

      cb(null, res)
    } catch (err) {
      this._err(err, 'getMovements', cb)
    }
  }

  async getFundingOfferHistory (space, args, cb) {
    try {
      const res = await prepareApiResponse(
        args,
        this.ctx.grc_bfx.caller,
        'fundingOfferHistory',
        'mtsUpdate',
        'symbol'
      )
      res.res = parseFields(res.res, { executed: true, rate: true })

      cb(null, res)
    } catch (err) {
      this._err(err, 'getFundingOfferHistory', cb)
    }
  }

  async getFundingLoanHistory (space, args, cb) {
    try {
      const res = await prepareApiResponse(
        args,
        this.ctx.grc_bfx.caller,
        'fundingLoanHistory',
        'mtsUpdate',
        'symbol'
      )
      res.res = parseFields(res.res, { rate: true })

      cb(null, res)
    } catch (err) {
      this._err(err, 'getFundingLoanHistory', cb)
    }
  }

  async getFundingCreditHistory (space, args, cb) {
    try {
      const res = await prepareApiResponse(
        args,
        this.ctx.grc_bfx.caller,
        'fundingCreditHistory',
        'mtsUpdate',
        'symbol'
      )
      res.res = parseFields(res.res, { rate: true })

      cb(null, res)
    } catch (err) {
      this._err(err, 'getFundingCreditHistory', cb)
    }
  }

  async getMultipleCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getMultipleCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getMultipleCsv', cb)
    }
  }

  async getTradesCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getTradesCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getTradesCsv', cb)
    }
  }

  async getTickersHistoryCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getTickersHistoryCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getTickersHistoryCsv', cb)
    }
  }

  async getWalletsCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getWalletsCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getWalletsCsv', cb)
    }
  }

  async getPositionsHistoryCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getPositionsHistoryCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getPositionsHistoryCsv', cb)
    }
  }

  async getPositionsAuditCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getPositionsAuditCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getPositionsAuditCsv', cb)
    }
  }

  async getPublicTradesCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getPublicTradesCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getPublicTradesCsv', cb)
    }
  }

  async getLedgersCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getLedgersCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getLedgersCsv', cb)
    }
  }

  async getOrdersCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getOrdersCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getOrdersCsv', cb)
    }
  }

  async getMovementsCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getMovementsCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getMovementsCsv', cb)
    }
  }

  async getFundingOfferHistoryCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getFundingOfferHistoryCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getFundingOfferHistoryCsv', cb)
    }
  }

  async getFundingLoanHistoryCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getFundingLoanHistoryCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getFundingLoanHistoryCsv', cb)
    }
  }

  async getFundingCreditHistoryCsv (space, args, cb) {
    try {
      const status = await getCsvStoreStatus(this, args)
      const jobData = await getFundingCreditHistoryCsvJobData(this, args)
      const processorQueue = this.ctx.lokue_processor.q

      processorQueue.addJob(jobData)

      cb(null, status)
    } catch (err) {
      this._err(err, 'getFundingCreditHistoryCsv', cb)
    }
  }

  _err (err, caller, cb) {
    const options = toString(err.options)
    const logTxtErr = `
    function: ${caller}
    statusCode: ${err.statusCode}
    name: ${err.name}
    message: ${err.message}
    options: ${options}

    `
    const logger = this.ctx.grc_bfx.caller.logger
    logger.error(logTxtErr)

    if (cb) cb(err)
    else throw err
  }
}

module.exports = ReportService
