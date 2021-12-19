import pino from 'pino'

const log = pino({
  level: 'trace',
  transport: {
    target: 'pino-pretty'
  }
})

export default log
