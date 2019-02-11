'use strict'

module.exports = async (
  reportService,
  args,
  positionsHistory
) => {
  const positions = []
  const auth = args.auth && typeof args.auth === 'object'
    ? args.auth
    : {}

  for (const position of positionsHistory) {
    delete position.liquidationPrice

    const symbol = position.symbol
    const end = position.mtsUpdate
    const id = position.id

    if (
      !symbol ||
      typeof symbol !== 'string' ||
      /tBFX/gi.test(symbol) ||
      !Number.isInteger(end) ||
      !Number.isInteger(id)
    ) {
      positions.push(position)

      continue
    }

    const tradesArgs = {
      auth,
      params: {
        symbol,
        end,
        notCheckNextPage: true,
        notThrowError: true
      }
    }

    const { res: trades } = await reportService._getTrades(tradesArgs)

    if (
      !Array.isArray(trades) ||
      trades.length === 0
    ) {
      positions.push(position)

      continue
    }

    const firstOrderID = (
      typeof trades[0] === 'object' &&
      trades[0].orderID
    )
    const secondOrderID = (
      trades.length > 1 &&
      typeof trades[1] === 'object' &&
      trades[1].orderID
    )

    if (
      !Number.isInteger(secondOrderID) ||
      firstOrderID === secondOrderID
    ) {
      const ledgersArgs = {
        auth,
        params: {
          end,
          notCheckNextPage: true,
          notThrowError: true
        }
      }

      const { res: _ledgers } = await reportService._getLedgers(ledgersArgs)
      const ledgers = Array.isArray(_ledgers) ? _ledgers : []

      const regexp = new RegExp(`#${id}.*settlement`, 'gi')
      const closedPosition = ledgers.find(ledger => (
        ledger &&
        typeof ledger === 'object' &&
        regexp.test(ledger.description)
      ))
      const closePrice = (
        closedPosition &&
        typeof closedPosition === 'object' &&
        closedPosition.description &&
        typeof closedPosition.description === 'string'
      )
        ? closedPosition.description
        : null

      positions.push({
        ...position,
        closePrice,
        pl: null,
        plPerc: null
      })

      continue
    }

    const orderID = secondOrderID
    const closedTrade = trades[0]
    const orderIdTrades = trades.filter(trade => (
      Number.isInteger(orderID) &&
      trade &&
      typeof trade === 'object' &&
      trade.orderID === orderID
    ))
    const {
      sumAmount,
      $notional
    } = orderIdTrades.reduce(({ sumAmount = 0, $notional = 0 }, trade) => {
      const _sumAmount = (
        Number.isFinite(sumAmount) &&
        Number.isFinite(trade.execAmount)
      )
        ? sumAmount + trade.execAmount
        : false
      const _$notional = (
        Number.isFinite($notional) &&
        Number.isFinite(trade.execAmount) &&
        Number.isFinite(trade.execPrice)
      )
        ? $notional + trade.execAmount * trade.execPrice
        : false

      return {
        sumAmount: _sumAmount,
        $notional: _$notional
      }
    }, {})

    if (
      !closedTrade ||
      typeof closedTrade !== 'object' ||
      !Number.isFinite(closedTrade.execPrice) ||
      !sumAmount ||
      !$notional
    ) {
      positions.push(position)

      continue
    }

    const closePrice = closedTrade.execPrice
    const basePrice = $notional / sumAmount
    const pl = closePrice - basePrice
    const plPerc = ((closePrice / basePrice) - 1) * 100

    positions.push({
      ...position,
      closePrice,
      pl,
      plPerc
    })
  }

  return positions
}
