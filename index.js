// https://developers.google.com/calendar/api/v3/reference/events/list#try-it

import monthly from 'monthly'

import { GApi } from './gapi.js' 

import { CLIENT_ID, CLIENT_SECRET } from './api-secrets.js'
import { CALENDAR_ID } from './config-secrets.js'

// const CAL_URI = `https://apidata.googleusercontent.com/caldav/v2/${CALENDAR_ID}/user`

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

// See https://developers.google.com/identity/protocols/oauth2/limited-input-device
const calendar = new GApi({
  urlPrefix: `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}`,
  scope: SCOPE,
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
})

// console.log('Access Token', api.token)
const { summary: calendarName } = await calendar.request()

const TIME_MIN = new Date(2021, 10, 1).toISOString()
const TIME_MAX = new Date(2022, 10, 1).toISOString()

const events = await calendar.request(`/events?singleEvents=true&orderBy=startTime&timeMin=${TIME_MIN}&timeMax=${TIME_MAX}`)
// console.log(calendarName)
// console.dir(events.items.slice(0, 2), { depth: null })

const consoleCalendar = monthly({
  date: new Date,
  startDay: 1,
  freeDay: [0, 6],
  locale: 'de',
  underline: getDaysWithAppointments(events.items),
})

console.log(consoleCalendar.join('\n'))

function getDaysWithAppointments(events) {
  const daysWithEvents = {}

  // missing multi day events for now
  for (const e of events) {
    if (e.start?.dateTime?.startsWith('2021-11-')) {
      const startDay = e.start.dateTime.substr(8,2)
      daysWithEvents[startDay] = (daysWithEvents[startDay] ?? 0) + 1
    }
  }
  // console.log(daysWithEvents)

  return Object.keys(daysWithEvents).map(dayOfMonthAsString => parseInt(dayOfMonthAsString, 10))
}