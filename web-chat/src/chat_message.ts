/**
 * ChatMessage is used by the various show case waku apps that demonstrates
 * waku used as the network layer for chat group applications.
 *
 * This is included to help building PoC and MVPs. Apps that aim to be
 * production ready should use a more appropriate data structure.
 */

type ChatFields = {
  timestamp: number;
  nick: string;
  fromPubkey: string;
  payload: string;
};

export class ChatMessage {
  public constructor(public chatFields: ChatFields) {}

  /**
   * Create Chat Message with a utf-8 string as payload.
   */
  static fromUtf8String(
    timestamp: Date,
    nick: string,
    fromPubkey: string,
    text: string
  ): ChatMessage {
    const timestampNumber = Math.floor(timestamp.valueOf() / 1000);

    return new ChatMessage({
      timestamp: timestampNumber,
      nick,
      fromPubkey,
      payload: text,
    });
  }

  /**
   * Decode a protobuf payload to a ChatMessage.
   * @param bytes The payload to decode.
   */
  static decode(json: string): ChatMessage {
    const fields = JSON.parse(json);
    return new ChatMessage(fields);
  }

  /**
   * Encode this ChatMessage to a byte array, to be used as a protobuf payload.
   * @returns The encoded payload.
   */
  encode(): string {
    return JSON.stringify(this.chatFields);
  }

  get timestamp(): Date {
    return new Date(this.chatFields.timestamp * 1000);
  }

  get nick(): string {
    return this.chatFields.nick;
  }
}
