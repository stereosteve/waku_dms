import { WakuMessage } from 'js-waku'

type ChatFields = {
  timestamp: number
  nick: string
  fromPubkey: string
  toPubkeys?: string[]
  chan?: string
  payload: string
}

export class Message {
  public chatMessage: ChatFields

  // WakuMessage timestamp
  public sentTimestamp: Date | undefined

  constructor(chatMessage: ChatFields, sentTimestamp: Date | undefined) {
    this.chatMessage = chatMessage
    this.sentTimestamp = sentTimestamp
  }

  static fromWakuMessage(wakuMsg: WakuMessage): Message | undefined {
    if (wakuMsg.payload) {
      try {
        const chatFields: ChatFields = JSON.parse(wakuMsg.payloadAsUtf8)
        // should validate JSON here
        return new Message(chatFields, wakuMsg.timestamp)
      } catch (e) {
        console.error('Failed to decode chat message', e)
      }
    }
    return
  }

  encode() {
    return JSON.stringify(this.chatMessage)
  }

  get nick() {
    return this.chatMessage.nick
  }

  get timestamp() {
    return this.chatMessage.timestamp
  }

  get payloadAsUtf8() {
    return this.chatMessage.payload
  }
}
