import fs from 'fs'
import yargs from 'yargs'

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
  .argv

console.log('TEST', args)


// import { CLIENT_ID, CLIENT_SECRET } from '/etc't