import { WakuMessage } from "js-waku";
import { ChatMessage } from "./chat_message";

export class Message {
  public chatMessage: ChatMessage;
  // WakuMessage timestamp
  public sentTimestamp: Date | undefined;

  constructor(chatMessage: ChatMessage, sentTimestamp: Date | undefined) {
    this.chatMessage = chatMessage;
    this.sentTimestamp = sentTimestamp;
  }

  static fromWakuMessage(wakuMsg: WakuMessage): Message | undefined {
    if (wakuMsg.payload) {
      try {
        const chatMsg = ChatMessage.decode(wakuMsg.payloadAsUtf8);
        if (chatMsg) {
          return new Message(chatMsg, wakuMsg.timestamp);
        }
      } catch (e) {
        console.error("Failed to decode chat message", e);
      }
    }
    return;
  }

  get nick() {
    return this.chatMessage.nick;
  }

  get timestamp() {
    return this.chatMessage.timestamp;
  }

  get payloadAsUtf8() {
    return this.chatMessage.chatFields.payload;
  }
}
