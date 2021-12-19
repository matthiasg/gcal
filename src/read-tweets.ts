import fetch from 'node-fetch'

export interface Tweet {
  id: string
  text: string
}

export async function readLastTweetByUser({ userId, bearerToken }: { userId: number, bearerToken: string }) {
  const response = await fetch(`https://api.twitter.com/2/users/${userId}/tweets`, {
    headers: {
      Authorization: `Bearer ${bearerToken}`
    }
  })

  if (response.ok) {
    const recentTweets: { data: Tweet[] } = <any> await response.json()
    return recentTweets.data[0]
  } else {
    return null
  }
}