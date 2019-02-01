'use strict'

const { promisify } = require('util')
const fs = require('fs')
const { stringify } = require('csv')
const unlink = promisify(fs.unlink)

const {
  createUniqueFileName,
  writableToPromise,
  writeDataToStream
} = require('./helpers')

const { isAuthError } = require('../helpers')

let reportService = null

module.exports = async job => {
  const filePaths = []
  const subParamsArr = []
  const processorQueue = reportService.ctx.lokue_processor.q
  const isUnauth = job.data.isUnauth || false
  const jobsData = Array.isArray(job.data.jobsData)
    ? job.data.jobsData
    : [job.data]

  try {
    if (
      !job.data.args.params ||
      typeof job.data.args.params !== 'object'
    ) {
      job.data.args.params = {}
    }

    for (const data of jobsData) {
      if (
        !data.args.params ||
        typeof data.args.params !== 'object'
      ) {
        data.args.params = {}
      }

      const filePath = await createUniqueFileName()
      filePaths.push(filePath)
      subParamsArr.push({
        ...data.args.params,
        name: data.name
      })

      const write = isUnauth
        ? 'Your file could not be completed, please try again'
        : data

      const writable = fs.createWriteStream(filePath)
      const writablePromise = writableToPromise(writable)
      const stringifier = stringify({
        header: true,
        columns: data.columnsCsv
      })

      stringifier.pipe(writable)

      await writeDataToStream(
        reportService,
        stringifier,
        write
      )

      stringifier.end()

      await writablePromise
    }

    job.done()
    processorQueue.emit('completed', {
      userInfo: job.data.userInfo,
      userId: job.data.userId,
      name: job.data.name,
      filePaths,
      subParamsArr,
      email: job.data.args.params.email,
      isUnauth
    })
  } catch (err) {
    try {
      for (const filePath of filePaths) {
        await unlink(filePath)
      }
    } catch (err) {
      processorQueue.emit('error:unlink', job)
    }

    job.done(err)

    if (isAuthError(err)) {
      processorQueue.emit('error:auth', job)
    }

    processorQueue.emit('error:base', err, job)
  }
}

module.exports.setReportService = (rService) => {
  reportService = rService
}
