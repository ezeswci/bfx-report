'use strict'

const EventEmitter = require('events')
const _ = require('lodash')

const { setProgress, delay } = require('./helpers')
const {
  isRateLimitError,
  isNonceSmallError
} = require('../helpers')
const { getMethodCollMap } = require('./schema')

const MESS_ERR_UNAUTH = 'ERR_AUTH_UNAUTHORIZED'

class DataInserter extends EventEmitter {
  constructor (reportService, methodCollMap) {
    super()

    this.reportService = reportService
    this.dao = this.reportService.dao
    this._methodCollMap = (methodCollMap instanceof Map)
      ? new Map(methodCollMap)
      : getMethodCollMap()
    this._auth = null
  }

  async setProgress (progress) {
    await setProgress(this.reportService, progress)

    this.emit('progress', progress)
  }

  async getAuthFromDb () {
    try {
      const users = await this.dao.getActiveUsers()
      const auth = new Map()

      if (_.isEmpty(users)) {
        return auth
      }

      users.forEach(user => {
        auth.set(
          user.apiKey,
          {
            apiKey: user.apiKey,
            apiSecret: user.apiSecret
          }
        )
      })

      this._auth = auth

      return this._auth
    } catch (err) {
      this._auth = null

      return this._auth
    }
  }

  async insertNewDataToDbMultiUser () {
    await this.getAuthFromDb()

    if (
      !this._auth ||
      !(this._auth instanceof Map) ||
      this._auth.size === 0
    ) {
      await this.setProgress(MESS_ERR_UNAUTH)

      return
    }

    let count = 1

    for (const authItem of this._auth) {
      if (typeof authItem[1] !== 'object') {
        continue
      }

      const userProgress = count / this._auth.size
      await this.insertNewDataToDb(authItem[1], userProgress)
      count += 1
    }
  }

  async insertNewDataToDb (auth, userProgress = 1) {
    if (
      typeof auth.apiKey !== 'string' ||
      typeof auth.apiSecret !== 'string'
    ) {
      await this.setProgress(MESS_ERR_UNAUTH)

      return
    }

    const methodCollMap = await this.checkNewData(auth)
    let count = 0

    for (const [method, item] of methodCollMap) {
      await this._insertApiDataArrObjTypeToDb(auth, method, item)
      await this._updateApiDataArrObjTypeToDb(auth, method, item)
      await this._updateApiDataArrTypeToDb(auth, method, item)

      count += 1
      const progress = Math.round((count / methodCollMap.size) * 100 * userProgress)
      await this.setProgress(progress)
    }

    await this.setProgress(100)
  }

  async checkNewData (auth) {
    const methodCollMap = this._getMethodCollMap()

    await this._checkNewDataArrObjType(auth, methodCollMap)

    return new Map([...methodCollMap].filter(([key, value]) => value.hasNewData))
  }

  async _checkNewDataArrObjType (auth, methodCollMap) {
    for (let [method, item] of this._methodCollMap) {
      if (!this._isInsertableArrObjTypeOfColl(item)) {
        continue
      }

      const args = this._getMethodArgMap(method, { ...auth }, 1)
      const lastElemFromDb = await this.dao.getLastElemFromDb(
        item.name,
        { ...auth },
        item.sort
      )
      const lastElemFromApi = await this._getDataFromApi(method, args)

      methodCollMap.get(method).hasNewData = false

      if (_.isEmpty(lastElemFromApi)) {
        continue
      }

      if (_.isEmpty(lastElemFromDb)) {
        methodCollMap.get(method).hasNewData = true
        methodCollMap.get(method).start = 0

        continue
      }

      const lastDateInDb = this._compareElemsDbAndApi(
        item.dateFieldName,
        lastElemFromDb,
        lastElemFromApi
      )

      if (lastDateInDb) {
        methodCollMap.get(method).hasNewData = true
        methodCollMap.get(method).start = lastDateInDb + 1
      }
    }

    return methodCollMap
  }

  _isInsertableArrObjTypeOfColl (coll) {
    return coll.type === 'insertable:array:objects'
  }

  _isUpdatableArrObjTypeOfColl (coll) {
    return coll.type === 'updatable:array:objects'
  }

  _isUpdatableArrTypeOfColl (coll) {
    return coll.type === 'updatable:array'
  }

  async _getDataFromApi (methodApi, args) {
    if (
      typeof this.reportService[methodApi] !== 'function'
    ) {
      throw new Error('ERR_METHOD_NOT_FOUND')
    }

    let countRateLimitError = 0
    let countNonceSmallError = 0
    let res = null

    while (true) {
      try {
        res = await this.reportService[methodApi](args)

        break
      } catch (err) {
        if (isRateLimitError(err)) {
          countRateLimitError += 1

          if (countRateLimitError > 1) {
            throw err
          }

          await delay()

          continue
        } else if (isNonceSmallError(err)) {
          countNonceSmallError += 1

          if (countNonceSmallError > 20) {
            throw err
          }

          await delay(1000)

          continue
        } else throw err
      }
    }

    return res
  }

  async _insertApiDataArrObjTypeToDb (
    auth,
    methodApi,
    schema
  ) {
    if (!this._isInsertableArrObjTypeOfColl(schema)) {
      return
    }

    const {
      start,
      name: collName,
      dateFieldName,
      model
    } = schema

    const args = this._getMethodArgMap(methodApi, { ...auth }, 10000000, start)
    const _args = _.cloneDeep(args)
    const currIterationArgs = _.cloneDeep(_args)

    let res = null
    let count = 0
    let timeOfPrevIteration = _args.params.end

    while (true) {
      res = await this._getDataFromApi(methodApi, currIterationArgs)

      if (
        !res ||
        !Array.isArray(res) ||
        res.length === 0
      ) break

      const lastItem = res[res.length - 1]

      if (
        typeof lastItem !== 'object' ||
        !lastItem[dateFieldName] ||
        !Number.isInteger(lastItem[dateFieldName])
      ) break

      const currTime = lastItem[dateFieldName]
      let isAllData = false

      if (currTime >= timeOfPrevIteration) {
        break
      }

      if (_args.params.start >= currTime) {
        res = res.filter((item) => _args.params.start <= item[dateFieldName])
        isAllData = true
      }

      if (_args.params.limit < (count + res.length)) {
        res.splice(_args.params.limit - count)
        isAllData = true
      }

      await this.dao.insertElemsToDb(
        collName,
        { ..._args.auth },
        this._normalizeApiData(res, model)
      )

      count += res.length
      const needElems = _args.params.limit - count

      if (isAllData || needElems <= 0) {
        break
      }

      timeOfPrevIteration = currTime
      currIterationArgs.params.end = lastItem[dateFieldName] - 1
      if (needElems) currIterationArgs.params.limit = needElems
    }
  }

  async _updateApiDataArrTypeToDb (
    auth,
    methodApi,
    schema
  ) {
    if (!this._isUpdatableArrTypeOfColl(schema)) {
      return
    }

    const {
      name: collName,
      field
    } = schema

    const args = this._getMethodArgMap(methodApi, { ...auth }, null, null, null)
    const elemsFromApi = await this._getDataFromApi(methodApi, args)

    if (
      Array.isArray(elemsFromApi) &&
      elemsFromApi.length > 0
    ) {
      await this.dao.removeElemsFromDbIfNotInLists(
        collName,
        { [field]: elemsFromApi }
      )
      await this.dao.insertElemsToDbIfNotExists(
        collName,
        elemsFromApi.map(item => ({ [field]: item }))
      )
    }
  }

  async _updateApiDataArrObjTypeToDb (
    auth,
    methodApi,
    schema
  ) {
    if (!this._isUpdatableArrObjTypeOfColl(schema)) {
      return
    }

    const {
      name: collName,
      fields,
      model
    } = schema

    const args = this._getMethodArgMap(methodApi, { ...auth }, null, null, null)
    const elemsFromApi = await this._getDataFromApi(methodApi, args)

    if (
      Array.isArray(elemsFromApi) &&
      elemsFromApi.length > 0
    ) {
      const lists = fields.reduce((obj, curr) => {
        obj[curr] = elemsFromApi.map(item => item[curr])

        return obj
      }, {})

      await this.dao.removeElemsFromDbIfNotInLists(
        collName,
        lists
      )
      await this.dao.insertElemsToDbIfNotExists(
        collName,
        this._normalizeApiData(elemsFromApi, model)
      )
    }
  }

  _compareElemsDbAndApi (dateFieldName, elDb, elApi) {
    const _elDb = Array.isArray(elDb) ? elDb[0] : elDb
    const _elApi = Array.isArray(elApi) ? elApi[0] : elApi

    return (_elDb[dateFieldName] < _elApi[dateFieldName])
      ? _elDb[dateFieldName]
      : false
  }

  _getMethodArgMap (
    method,
    auth = { apiKey: '', apiSecret: '' },
    limit,
    start = 0,
    end = (new Date()).getTime()
  ) {
    return {
      auth,
      params: {
        limit: limit !== null ? limit : this._methodCollMap.get(method).maxLimit,
        end,
        start
      }
    }
  }

  _getMethodCollMap () {
    return new Map(this._methodCollMap)
  }

  _normalizeApiData (data = [], model) {
    return data.map(item => {
      if (
        typeof item !== 'object' ||
        typeof model !== 'object' ||
        Object.keys(model).length === 0
      ) {
        return item
      }

      return _.pick(item, Object.keys(model))
    })
  }
}

module.exports = DataInserter