import { GApi } from './gapi.js'

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const URL_PREFIX = 'https://www.googleapis.com/calendar/v3/calendars'

export async function readCalendar({ clientId, clientSecret, token }) {
  console.log(clientId)

  const api = new GApi({
    scope: SCOPE,
    urlPrefix: URL_PREFIX,
    client_id: clientId,
    client_secret: clientSecret,
    tokenPath: token
  })

  const response = await api.request()


}