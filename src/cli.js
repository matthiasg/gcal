import fs from 'fs'
import yargs from 'yargs'

import { readCalendar } from './read-calendar.js'

const args = yargs(process.argv.slice(2))
  .config('config', function (configPath) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  })
  .option('clientId', {
    description: 'Google Client ID to access Google Calendar',
    demandOption: true,
  })
  .option('clientSecret', {
    description: 'Google Client Secret to access Google Calendar',
    demandOption: true,
  })
  .option('width', {
    type: 'number',
    default: 600,
    description: 'The width to render the image to. If the render target is configured to an actual display this needs to match the driver'
  })
  .option('height', {
    type: 'number',
    default: 800,
    description: 'The height to render the image to. If the render target is configured to an actual display this needs to match the driver'
  })
  .option('token', {
    type: 'string',
    default: '/var/e-paper-calendar-token.json',
    description: 'This file will contain the authentication token to access the chosen google calendar'
  })
  .argv

console.log('TEST', args)

readCalendar(args)
// import { CLIENT_ID, CLIENT_SECRET } from '/etc't