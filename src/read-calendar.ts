import path from 'node:path'
import { readFile, mkdir, writeFile } from 'node:fs/promises'

import log from './log.js'
import { GApi } from './gapi.js'

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const URL_PREFIX = 'https://www.googleapis.com/calendar/v3'

export async function readCalendar({ calendar, clientId, clientSecret, tokenPath, calendarSettingsPath }) {
  console.log(clientId)

  const api = new GApi({
    scope: SCOPE,
    urlPrefix: URL_PREFIX,
    client_id: clientId,
    client_secret: clientSecret,
    tokenPath,
  })

  const calendarId = await getCalendarId({ api, calendarName: calendar, calendarSettingsPath })
  const events = await getEvents({ api, calendarId })

  if (events.length === 0) {
    return []
  }

  const nextEvent = events[0]
  log.info({ nextEvent }, 'Next event \'%s\' at %s', nextEvent.summary, nextEvent.start.dateTime)

  return events
}

async function getCalendarId({ api, calendarName, calendarSettingsPath }) {
  const storedCalendarId = await tryReadStoredCalendarId(calendarSettingsPath)

  if (storedCalendarId) {
    log.trace({ storedCalendarId, calendarSettingsPath }, 'Calendar read from storage')
    return storedCalendarId
  }

  log.trace('No stored calendar id')

  const potentialCalendars = await readPotentialCalenders({ api })
  log.info({ potentialCalendars }, '#%d potential calendars', potentialCalendars.length)

  const bestMatch = potentialCalendars.find(i => i.name === calendarName) ?? potentialCalendars[0]

  if (!bestMatch) {
    log.error({ potentialCalendars }, 'Could not find a calendar')
  }

  log.info('Using calendar %s (%s)', bestMatch.name, bestMatch.id)

  return bestMatch.id
}

async function getEvents({ api, calendarId }) {
  const now = new Date()

  const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const timeMax = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()

  const events = await api.request(`/calendars/${calendarId}/events?singleEvents=true&orderBy=startTime&timeMin=${timeMin}&timeMax=${timeMax}`)
  
  log.trace({ events }, 'Got #%d events', events.items.length)

  return events.items
}

async function readPotentialCalenders({ api }) {
  const response: { items: any[] } = await api.request('/users/me/calendarList')
  
  return response.items.map((c: any) => {
    return {
      id: c.id,
      name: c.summary,
      description: c.description,
    }
  })
}

async function tryReadStoredCalendarId(settingsPath: string) {
  try {
    const calendarId = await readFile(settingsPath, 'utf-8')
    return calendarId
  } catch (error) {
    return null
  }
}

async function tryStoreCalendarId(settingsPath: string, calendarId: string) {
  try {
    const directoryPath = path.dirname(settingsPath)
    await mkdir(directoryPath, { recursive: true })
    await writeFile(settingsPath, calendarId, 'utf8')
  } catch (error) {
    console.error('Could not store calendar id', error.toString())
  }
}
