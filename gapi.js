import fs from 'fs/promises'
import fetch from 'node-fetch'
import qr from 'qrcode-terminal'

export class GApi {
  constructor({ urlPrefix, scope, client_id, client_secret, tokenPath = 'data/token.json' }) {
    this.urlPrefix = urlPrefix
    this.scope = scope
    this.client_id = client_id
    this.client_secret = client_secret
    this.token = null
    this.tokenPath = tokenPath
  }

  async request(designatedUrl = '', options = {}) {
    const url = designatedUrl.startsWith('http') ? designatedUrl : this.urlPrefix + designatedUrl

    if (!this.token) {
      this.token = await this.getToken()
    }

    const headers = { ...options?.headers }
    
    for (;;) {
      headers['Authorization'] = `Bearer ${this.token.access_token}`

      const response = await fetch(url, {
        ...options,
        headers,
      })
      
      if (response.status === 200) {
        return await response.json()
      }
      
      if (response.status === 401) {
        const error = await response.json()

        if (error?.error === 'invalid_token') {
          console.warn('Token invalid', error?.error_description)
        } else {
          console.error('Unknown Access Error', error)
          throw new Error('Unknown access error')
        }

        await this._refreshToken()
      } else {
        const text = await response.text()
        console.error('Error in request', response, text)
        throw new Error('Error in request')
      }
    }
  }

  async _refreshToken() {
    console.log('refreshing token')
    const refreshTokenResponse = await fetch(`https://oauth2.googleapis.com/token?client_id=${this.client_id}&client_secret=${this.client_secret}&grant_type=refresh_token&refresh_token=${this.token.refresh_token}`, { method: 'POST' }) 
    
    if (refreshTokenResponse.ok) {
      const refreshedToken = await refreshTokenResponse.json()

      for (const [key, value] of Object.entries(refreshedToken)) {
        this.token[key] = value
      }

      const tokenAsString = JSON.stringify(this.token, null, 2)
      await fs.writeFile(this.tokenPath, tokenAsString, 'utf8')

      console.log('refreshed token', this.token)
    } else {
      console.error('Could not refresh token', refreshTokenResponse)
      throw new Error('Could not refesh token')
    }
  }
  
  async getToken() {
    try {
      const content = await fs.readFile(this.tokenPath, 'utf8')
      const token = JSON.parse(content)
      return token
    } catch (error) {
      const initialTokenPrompt = await fetch(`https://oauth2.googleapis.com/device/code?client_id=${this.client_id}&scope=${this.scope}`, {
        method: 'POST',
      })
  
      const tokenPromptInfo = await initialTokenPrompt.json()
      
      qr.generate(tokenPromptInfo.verification_url)
  
      console.log('\nEnter the following code:', tokenPromptInfo.user_code)
  
      const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'
  
      for (let i =0; i<1000; i++) {
        const tokenResponse = await fetch(`https://oauth2.googleapis.com/token?client_id=${this.client_id}&client_secret=${this.client_secret}&device_code=${tokenPromptInfo.device_code}&grant_type=${DEVICE_CODE_GRANT}`, {
          method: 'POST',
        })
  
        if (tokenResponse.ok) {
          const token = await tokenResponse.json()
  
          const tokenAsString = JSON.stringify(token, null, 2)
          await fs.writeFile(this.tokenPath, tokenAsString, 'utf8')
          return token
        } else if (tokenResponse.status === 403) {
          await sleep(2000)
        }
  
        await sleep(500)
      }
  
      console.error('Timeout waiting for token')
      process.exit(2)
    }
  }
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms))}
